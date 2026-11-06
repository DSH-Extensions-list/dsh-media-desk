// Read public information from web pages and profile pages. Public HTML only:
// no login, and no working around a platform's restrictions.
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { tr } from './i18n.js'

const MAX_BYTES = 1_500_000
const TIMEOUT_MS = 8000
const MAX_REDIRECTS = 4

function isPrivateAddress(address) {
  if (address === '::1' || address === '::') return true
  const lower = address.toLowerCase()
  if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true
  let v4 = lower.startsWith('::ffff:') ? lower.slice(7) : lower
  // The URL parser normalises ::ffff:127.0.0.1 to ::ffff:7f00:1, so check the hex form too.
  const mapped = /^([\da-f]{1,4}):([\da-f]{1,4})$/.exec(v4)
  if (mapped) {
    const high = parseInt(mapped[1], 16)
    const low = parseInt(mapped[2], 16)
    v4 = `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
  }
  if (isIP(v4) !== 4) return false
  const [a, b] = v4.split('.').map(Number)
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

/** A pasted link can point anywhere, so it must never reach this machine or the local network. */
export async function assertPublicUrl(raw) {
  const url = new URL(raw)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(tr('Only http and https links are supported'))
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error(tr('Can\'t fetch addresses on this machine'))
  const records = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (records.some(record => isPrivateAddress(record.address))) throw new Error(tr('Can\'t fetch private network addresses'))
  return url
}

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (all, name) => named[name.toLowerCase()] ?? all)
    .trim()
}

function meta(html, names) {
  for (const name of names) {
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html)
    if (a?.[1]) return decodeEntities(a[1])
    const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i').exec(html)
    if (b?.[1]) return decodeEntities(b[1])
  }
  return null
}

function followerHint(text) {
  // Pages are requested with an English accept-language header, so only the
  // English forms are parsed: "1.2k followers", "3m followers", "followers 12000".
  const m = /([\d.,]+)\s*([kKmM])?\s*followers/i.exec(text)
    ?? /followers[^\d]{0,6}([\d.,]+)\s*([kKmM])?/i.exec(text)
  if (!m) return null
  const unit = { k: 1e3, m: 1e6 }[String(m[2] ?? '').toLowerCase()] ?? 1
  const value = Number(m[1].replace(/,/g, '')) * unit
  return Number.isFinite(value) ? Math.round(value) : null
}

async function fetchPublic(raw, fetchImpl) {
  let current = raw
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(current)
    const res = await fetchImpl(url, {
      redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9' },
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), url).toString()
      continue
    }
    return { res, url }
  }
  throw new Error(tr('Too many redirects'))
}

async function readHtml(raw, fetchImpl) {
  const { res, url } = await fetchPublic(raw, fetchImpl)
  if (!res.ok) throw new Error(tr('The page returned {status}. It may need a login or be blocked by the platform.', { status: res.status }))
  const type = res.headers.get('content-type') || ''
  if (!/html|xml/i.test(type)) throw new Error(tr('This isn\'t a web page ({type})', { type: type || tr('unknown type') }))
  const reader = res.body.getReader()
  const chunks = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.length
  }
  await reader.cancel().catch(() => {})
  return { html: Buffer.concat(chunks).toString('utf8'), url }
}

/**
 * Fetch the body text of a public page, to learn a writing style from it.
 * @param {string} raw - Page URL.
 * @param {typeof fetch} [fetchImpl] - Swappable in tests.
 * @returns {Promise<{url: string, title: string|null, text: string}>} The page text.
 */
export async function harvestText(raw, fetchImpl = fetch) {
  const { html, url } = await readHtml(raw, fetchImpl)
  const title = meta(html, ['og:title']) ?? decodeEntities(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? '')
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|br|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  const text = decodeEntities(body).split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(line => line.length > 8).join('\n')
  return { url: url.toString(), title: title || null, text }
}

/**
 * Read a public page's title, description, cover image and any visible follower count.
 * @param {string} raw - Page URL.
 * @param {typeof fetch} [fetchImpl] - Swappable in tests.
 * @returns {Promise<{url: string, title: string|null, description: string|null, image: string|null, siteName: string|null, followers: number|null}>} Page metadata.
 */
export async function harvest(raw, fetchImpl = fetch) {
  const { html, url } = await readHtml(raw, fetchImpl)
  const title = meta(html, ['og:title', 'twitter:title']) ?? decodeEntities(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? '')
  const description = meta(html, ['og:description', 'description', 'twitter:description'])
  let image = meta(html, ['og:image', 'twitter:image', 'og:image:url'])
  if (image) {
    try {
      image = new URL(image, url).toString()
      if (!/^https?:/.test(image)) image = null
    } catch {
      image = null
    }
  }
  const siteName = meta(html, ['og:site_name']) ?? url.hostname.replace(/^www\./, '')
  return { url: url.toString(), title: title || null, description, image, siteName, followers: followerHint(`${description ?? ''} ${html.slice(0, 200000).replace(/<[^>]+>/g, ' ')}`) }
}
