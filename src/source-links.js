import { parseRedditSource } from './reddit.js'
import { tr } from './i18n.js'

// These paths on a profile URL are not account names
const RESERVED = {
  Instagram: new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'direct', 'tv']),
  X: new Set(['i', 'home', 'search', 'explore', 'intent', 'share', 'settings', 'messages', 'notifications', 'hashtag', 'compose']),
}

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com'])
const X_HOSTS = new Set(['x.com', 'www.x.com', 'm.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'm.twitter.com', 'mobile.twitter.com'])
const BARE_SOCIAL = /(?:^|[\s(])((?:(?:www|m|mobile|old|new)\.)?(?:instagram\.com|x\.com|twitter\.com|reddit\.com)\/[^\s"'<>()[\]{}]+)/gi
const BARE_WEB = /^(?:[a-z0-9-]+\.)+[a-z]{2,63}(?::[0-9]+)?(?:[/?#][^\s"'<>]*)?$/i

function cleanLink(value) {
  return value.replace(/[)\].,;!?]+$/, '')
}

function httpCandidates(value) {
  return (String(value ?? '').match(/https?:\/\/[^\s"'<>()[\]{}]+/gi) ?? []).map(cleanLink)
}

/** Find the first link in shared text. Text shared out of an app often mixes in a title and a share code. */
export function findUrl(text) {
  return httpCandidates(text)[0] ?? null
}

/**
 * Read a supported platform and account id out of a profile link.
 * @param {string} raw - The link.
 * @returns {{platform: string, id: string, url: string}|null} null when it isn't recognized.
 */
export function parseAccountUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null
  const host = url.hostname.toLowerCase()
  if (INSTAGRAM_HOSTS.has(host)) {
    const id = /^\/([\w.]{1,30})\/?$/.exec(url.pathname)?.[1]
    return id && !RESERVED.Instagram.has(id.toLowerCase()) ? { platform: 'Instagram', id, url: `https://www.instagram.com/${id}/` } : null
  }
  if (X_HOSTS.has(host)) {
    const id = /^\/(\w{1,15})\/?$/.exec(url.pathname)?.[1]
    return id && !RESERVED.X.has(id.toLowerCase()) ? { platform: 'X', id, url: `https://x.com/${id}` } : null
  }
  return null
}

export function parseConnectionInput(text, platform = '') {
  const value = String(text ?? '').trim()
  const candidates = httpCandidates(value)
  for (const [, bare] of value.matchAll(BARE_SOCIAL)) candidates.push('https://' + cleanLink(bare))
  if (/^\/?(?:r|u|user)\/[\w-]+\/?$/i.test(value)) {
    candidates.push('https://www.reddit.com/' + value.replace(/^\//, ''))
  }
  if (/^@?[\w.]+$/.test(value)) {
    const handle = value.replace(/^@/, '')
    if (platform === 'Instagram') candidates.push('https://www.instagram.com/' + handle + '/')
    if (platform === 'X') candidates.push('https://x.com/' + handle)
  }
  for (const candidate of candidates) {
    const source = parseAccountUrl(candidate) ?? parseRedditSource(candidate)
    if (source) return source
  }
  return null
}

/** A one-off link can be saved locally without requesting the destination. */
export function parseWebLink(text) {
  const value = String(text ?? '').trim()
  const raw = findUrl(value) ?? (BARE_WEB.test(value) ? 'https://' + value : null)
  if (!raw || !URL.canParse(raw)) return null
  const url = new URL(raw)
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
}

/** Read the platform and account id out of pasted text. */
export async function resolveAccount(text, platform) {
  const account = parseConnectionInput(text, platform)
  if (account) return account
  if (!platform && !findUrl(text)) throw Object.assign(new Error(tr('No link found. Paste the URL of the account\'s profile page.')), { status: 400 })
  throw Object.assign(new Error(tr('This profile link isn\'t recognized. Use an Instagram or X profile, or a Reddit profile or subreddit.')), { status: 400 })
}
