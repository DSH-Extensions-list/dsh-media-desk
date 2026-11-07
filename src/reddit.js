// Reddit import: read a user profile's or a subreddit's recent public posts.
// Reddit's JSON API carries score and comment counts, but it is blocked for many datacentre IPs.
// When that happens the same import falls back to the public Atom feed, which has no numbers but
// still gives titles, dates and links. No API key, no third-party service, and no XML dependency:
// the feed is small and regular enough for a few targeted regular expressions.
import { tr } from './i18n.js'

const REDDIT_HOSTS = new Set(['reddit.com', 'www.reddit.com', 'old.reddit.com', 'new.reddit.com', 'm.reddit.com'])
const RESERVED = new Set(['me', 'all', 'popular', 'saved', 'submit', 'login', 'register', 'settings', 'prefs'])
const USERNAME = /^[A-Za-z0-9_-]{3,20}$/
const SUBREDDIT = /^[A-Za-z0-9_]{3,21}$/
const SITE = 'https://www.reddit.com'
const MAX_POSTS = 25
const MAX_BODY = 4000
const MAX_FEED_BYTES = 2_000_000
const TIMEOUT_MS = 15_000
const JSON_TIMEOUT_MS = 6_000
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const JSON_ACCEPT = 'application/json, text/plain;q=0.9'
const RSS_ACCEPT = 'application/atom+xml, application/xml;q=0.9, text/xml;q=0.8'
const FALLBACK_NOTE = 'The JSON API was tried first and the feed fallback was attempted.'

const TIMEOUT_MESSAGE = 'Reddit took too long to answer. {fallback} Try again in a moment.'
const UNREACHABLE_MESSAGE = 'Could not reach Reddit. {fallback} Check your connection and try again.'
const FORBIDDEN_MESSAGE = 'Reddit refused the request (HTTP 403). Reddit sometimes blocks its JSON API and its public feed for datacentre IPs. {fallback} Try again later or from another network.'
const RATE_LIMITED_MESSAGE = 'Reddit rate-limited the request (HTTP 429). {fallback} Wait a few minutes before importing again.'
const TOO_LARGE_MESSAGE = 'The Reddit response is larger than expected. {fallback} Try again later.'
const UNREADABLE_MESSAGE = 'Could not read the Reddit feed. {fallback} Try again.'
const NOT_A_FEED_MESSAGE = 'Reddit did not return a feed. {fallback} Try again later.'

function failure(message, status, vars) {
  return Object.assign(new Error(tr(message, vars)), { status })
}

function sourceUrl(kind, id) {
  return kind === 'subreddit' ? `${SITE}/r/${id}` : `${SITE}/user/${id}`
}

/** Read one Reddit link. Only the two source path shapes are accepted, and only on Reddit's own host. */
function parseSourceUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null
  if (!REDDIT_HOSTS.has(url.hostname.toLowerCase())) return null
  const parts = url.pathname.split('/').filter(Boolean)
  const listingTab = parts.length === 3 && parts[0].toLowerCase() === 'r'
    && ['new', 'hot', 'top', 'rising', 'controversial'].includes(parts[2].toLowerCase())
  if (parts.length !== 2 && !listingTab) return null
  const head = parts[0].toLowerCase()
  const kind = head === 'r' ? 'subreddit' : head === 'user' || head === 'u' ? 'user' : null
  if (!kind) return null
  let id
  try {
    id = decodeURIComponent(parts[1])
  } catch {
    return null
  }
  const shape = kind === 'subreddit' ? SUBREDDIT : USERNAME
  if (!shape.test(id) || RESERVED.has(id.toLowerCase())) return null
  return { platform: 'Reddit', kind, id, url: sourceUrl(kind, id) }
}

/**
 * Find a Reddit profile or subreddit in a pasted link or in text that contains one.
 * @param {string} text - A Reddit URL, or text that includes one.
 * @returns {{platform: string, kind: 'user'|'subreddit', id: string, url: string}|null} null when it isn't a Reddit source.
 */
export function parseRedditSource(text) {
  if (typeof text !== 'string') return null
  const value = text.trim()
  if (!value) return null
  const candidates = value.match(/https?:\/\/[^\s"'<>]+/gi) ?? []
  // A link pasted without its scheme is common enough to accept, but only on the exact Reddit host.
  const bare = /(?:^|[\s(])((?:www\.)?reddit\.com\/(?:user|u|r)\/[^\s]+)/i.exec(value)
  if (bare) candidates.push(`https://${bare[1].replace(/[)\].,;!?]+$/, '')}`)
  for (const candidate of candidates) {
    const source = parseSourceUrl(candidate.replace(/[)\].,;!?]+$/, ''))
    if (source) return source
  }
  return null
}

/**
 * Find a Reddit profile in a pasted link. Kept for callers that only import user profiles.
 * @param {string} text - A profile URL, or text that includes one.
 * @returns {{platform: string, id: string, url: string}|null} null when it isn't a Reddit profile.
 */
export function parseRedditProfile(text) {
  const source = parseRedditSource(text)
  if (!source || source.kind !== 'user') return null
  return { platform: source.platform, id: source.id, url: source.url }
}

/** The two endpoints for one source. The JSON listing carries scores; the Atom feed does not. */
function feedUrls(source) {
  const id = encodeURIComponent(source.id)
  if (source.kind === 'subreddit') {
    return {
      json: `${SITE}/r/${id}/new.json?limit=${MAX_POSTS}&raw_json=1`,
      rss: `${SITE}/r/${id}/new/.rss`,
    }
  }
  return {
    json: `${SITE}/user/${id}/submitted.json?limit=${MAX_POSTS}&raw_json=1`,
    rss: `${SITE}/user/${id}/submitted.rss`,
  }
}

/** One request, one timeout, and the size cap enforced before and after reading the body. */
async function requestText(url, accept, timeoutMs, fetchImpl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let response
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': BROWSER_USER_AGENT,
          accept,
        },
      })
    } catch (err) {
      if (err?.name === 'AbortError' || err?.name === 'TimeoutError') throw failure(TIMEOUT_MESSAGE, 504, { fallback: FALLBACK_NOTE })
      throw failure(UNREACHABLE_MESSAGE, 502, { fallback: FALLBACK_NOTE })
    }
    const status = Number(response?.status ?? 0)
    if (status === 403) throw failure(FORBIDDEN_MESSAGE, 502, { fallback: FALLBACK_NOTE })
    if (status === 429) throw failure(RATE_LIMITED_MESSAGE, 429, { fallback: FALLBACK_NOTE })
    if (status < 200 || status >= 300) throw failure('Reddit returned an error (HTTP {status}). {fallback} Try again later.', 502, { status: status || tr('unknown'), fallback: FALLBACK_NOTE })
    const declared = Number(response?.headers?.get?.('content-length') ?? 0)
    if (Number.isFinite(declared) && declared > MAX_FEED_BYTES) throw failure(TOO_LARGE_MESSAGE, 502, { fallback: FALLBACK_NOTE })
    let text
    try {
      text = await response.text()
    } catch (err) {
      if (err?.name === 'AbortError' || err?.name === 'TimeoutError') throw failure(TIMEOUT_MESSAGE, 504, { fallback: FALLBACK_NOTE })
      throw failure(UNREADABLE_MESSAGE, 502, { fallback: FALLBACK_NOTE })
    }
    if (typeof text !== 'string') text = String(text ?? '')
    if (text.length > MAX_FEED_BYTES) throw failure(TOO_LARGE_MESSAGE, 502, { fallback: FALLBACK_NOTE })
    return text
  } finally {
    clearTimeout(timer)
  }
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function fromCodePoint(code, fallback) {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback
}

/** Decode the entities Reddit puts in its XML. `&amp;` is handled in the same pass, so it never
 * double-decodes text that was escaped twice. */
function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => fromCodePoint(parseInt(hex, 16), match))
    .replace(/&#(\d+);/g, (match, decimal) => fromCodePoint(parseInt(decimal, 10), match))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
}

function stripTags(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6]|blockquote|tr|td|th)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
}

/** The feed holds HTML escaped inside XML, so decode, strip the markup, then decode what the markup
 * held as text. Collapse the result to one line and cap it. JSON text is plain, but passing it
 * through the same cleaner keeps both paths consistent. */
function cleanText(value) {
  if (!value) return ''
  const decoded = decodeEntities(value)
  return decodeEntities(stripTags(decoded)).replace(/\s+/g, ' ').trim()
}

function tagText(entry, name) {
  const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i').exec(entry)
  return match ? match[1].trim() : ''
}

function linkHref(entry) {
  const match = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/i.exec(entry)
  return match ? decodeEntities(match[1]).trim() : ''
}

/** Atom names Reddit authors as `/u/name`; accept the bare name too. */
function entryAuthor(entry) {
  const block = /<author\b[^>]*>([\s\S]*?)<\/author>/i.exec(entry)?.[1] ?? ''
  const name = cleanText(tagText(block, 'name')).replace(/^\/?u\//i, '').trim()
  return name ? `u/${name}` : ''
}

function parseAtom(text, fallbackAuthor = '') {
  const posts = []
  const entries = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi
  let match
  while ((match = entries.exec(text)) && posts.length < MAX_POSTS) {
    const entry = match[1]
    const id = tagText(entry, 'id')
    const title = cleanText(tagText(entry, 'title'))
    if (!id || !title) continue
    const body = cleanText(tagText(entry, 'content')).slice(0, MAX_BODY)
    const publishedAt = tagText(entry, 'updated') || tagText(entry, 'published') || new Date().toISOString()
    // A user feed belongs to one author even when the entry leaves the author out.
    posts.push({ id, title, body, publishedAt, url: linkHref(entry), author: entryAuthor(entry) || fallbackAuthor, score: null, comments: null })
  }
  return posts
}

/** Reddit's JSON listing: each child is a t3 post with the numbers the Atom feed lacks. */
function jsonPost(child, fallbackAuthor = '') {
  const data = child?.data
  if (!data) return null
  const rawId = String(data.name ?? '').trim() || (Number.isFinite(Number(data.id)) ? `t3_${data.id}` : '')
  const title = cleanText(data.title)
  if (!rawId || !title) return null
  const selftext = cleanText(data.selftext)
  const created = Number(data.created_utc)
  const author = cleanText(data.author).replace(/^\/?u\//i, '').trim()
  const permalink = typeof data.permalink === 'string' && data.permalink.startsWith('/') ? `${SITE}${data.permalink}` : ''
  const url = permalink || (typeof data.url === 'string' && /^https?:\/\//i.test(data.url) ? data.url : '')
  return {
    id: rawId,
    title,
    // A link post has no selftext; the title is still a usable body.
    body: (selftext || title).slice(0, MAX_BODY),
    publishedAt: Number.isFinite(created) && created > 0 ? new Date(created * 1000).toISOString() : new Date().toISOString(),
    url,
    author: author ? `u/${author}` : fallbackAuthor,
    score: Number.isFinite(Number(data.score)) ? Math.round(Number(data.score)) : 0,
    comments: Number.isFinite(Number(data.num_comments)) ? Math.max(0, Math.round(Number(data.num_comments))) : 0,
  }
}

function parseJsonListing(text, fallbackAuthor = '') {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw failure('Reddit did not return JSON.', 502)
  }
  const children = data?.data?.children
  if (!Array.isArray(children)) throw failure('Reddit returned an unexpected JSON shape.', 502)
  return children.map(child => jsonPost(child, fallbackAuthor)).filter(Boolean).slice(0, MAX_POSTS)
}

/** Accept a parsed source, a link, or an already normalised source object. */
function normalizeSource(source) {
  if (typeof source === 'string') {
    const parsed = parseRedditSource(source)
    if (!parsed) throw failure('That Reddit link is not valid.', 400)
    return parsed
  }
  const kind = source?.kind
  const id = typeof source?.id === 'string' ? source.id.trim() : ''
  const shape = kind === 'subreddit' ? SUBREDDIT : kind === 'user' ? USERNAME : null
  if (!shape || !shape.test(id) || RESERVED.has(id.toLowerCase())) throw failure('That Reddit link is not valid.', 400)
  return { platform: 'Reddit', kind, id, url: sourceUrl(kind, id) }
}

/**
 * Read one page of a Reddit source: the JSON API first for scores and comment counts, then the
 * public Atom feed when JSON is blocked or unreadable. One JSON attempt and one feed attempt;
 * neither is retried, because Reddit rate-limits repeated calls.
 * @param {{platform: string, kind: 'user'|'subreddit', id: string, url: string}|string} source - A parsed Reddit source or a Reddit link.
 * @param {Function} [fetchImpl] - Replaced in tests.
 * @returns {Promise<{posts: object[], via: 'json'|'rss'}>} At most 25 posts and the path that produced them.
 */
export async function fetchRedditFeed(source, fetchImpl = fetch) {
  const feed = normalizeSource(source)
  const urls = feedUrls(feed)
  const fallbackAuthor = feed.kind === 'user' ? `u/${feed.id}` : ''
  const deadline = Date.now() + TIMEOUT_MS
  try {
    // A short JSON attempt leaves most of the budget for the feed.
    const text = await requestText(urls.json, JSON_ACCEPT, Math.min(JSON_TIMEOUT_MS, TIMEOUT_MS), fetchImpl)
    return { posts: parseJsonListing(text, fallbackAuthor), via: 'json' }
  } catch {
    // Reddit blocks its JSON API for datacentre IPs often enough that the feed is a normal path.
  }
  const remaining = Math.max(1_000, deadline - Date.now())
  const text = await requestText(urls.rss, RSS_ACCEPT, remaining, fetchImpl)
  if (!/<feed\b/i.test(text)) throw failure(NOT_A_FEED_MESSAGE, 502, { fallback: FALLBACK_NOTE })
  return { posts: parseAtom(text, fallbackAuthor), via: 'rss' }
}

/**
 * Read a Reddit user's public submissions. Kept as a convenience wrapper around fetchRedditFeed.
 * @param {string} username - The Reddit username.
 * @param {Function} [fetchImpl] - Replaced in tests.
 * @returns {Promise<object[]>} At most 25 posts with id, title, body, publishedAt, url, author, score and comments.
 */
export async function fetchRedditPosts(username, fetchImpl = fetch) {
  const id = String(username ?? '').trim()
  if (!USERNAME.test(id) || RESERVED.has(id.toLowerCase())) throw failure('That Reddit username is not valid.', 400)
  const { posts } = await fetchRedditFeed({ platform: 'Reddit', kind: 'user', id, url: sourceUrl('user', id) }, fetchImpl)
  return posts
}
