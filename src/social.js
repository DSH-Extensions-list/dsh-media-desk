import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assertPublicUrl } from './harvest.js'
import { newId } from './ops.js'
import { tr } from './i18n.js'

const COVER_MAX_BYTES = 8 * 1024 * 1024
const COVER_CONCURRENCY = 4

// These paths on a profile URL are not account names
const RESERVED = {
  Instagram: new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'direct', 'tv']),
  X: new Set(['i', 'home', 'search', 'explore', 'intent', 'share', 'settings', 'messages', 'notifications', 'hashtag', 'compose']),
}

function hostIs(host, name) {
  return host === name || host.endsWith(`.${name}`)
}

/** Find the first link in shared text. Text shared out of an app often mixes in a title and a share code. */
export function findUrl(text) {
  const match = /https?:\/\/[^\s"'<>()[\]{}]+/i.exec(String(text ?? ''))
  return match?.[0] ?? null
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
  if (hostIs(host, 'instagram.com')) {
    const id = /^\/([\w.]{1,30})\/?$/.exec(url.pathname)?.[1]
    return id && !RESERVED.Instagram.has(id.toLowerCase()) ? { platform: 'Instagram', id, url: `https://www.instagram.com/${id}/` } : null
  }
  if (hostIs(host, 'x.com') || hostIs(host, 'twitter.com')) {
    const id = /^\/(\w{1,15})\/?$/.exec(url.pathname)?.[1]
    return id && !RESERVED.X.has(id.toLowerCase()) ? { platform: 'X', id, url: `https://x.com/${id}` } : null
  }
  return null
}

/** Read the platform and account id out of pasted text. Reddit profiles are recognised by reddit.js
 * before this runs. */
export async function resolveAccount(text) {
  const first = findUrl(text)
  if (!first) throw Object.assign(new Error(tr('No link found. Paste the URL of the account\'s profile page.')), { status: 400 })
  const account = parseAccountUrl(first)
  if (account) return account
  throw Object.assign(new Error(tr('This profile link isn\'t recognized. Instagram, X and Reddit profiles are supported. For other platforms, paste your posts to learn a style.')), { status: 400 })
}

function sniffImage(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return '.jpg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return '.png'
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return '.gif'
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return '.webp'
  return null
}

/** Platform image URLs expire, so covers are saved locally. On failure this returns null and the import continues. */
async function saveCover(raw, filesDir, fetchImpl) {
  try {
    let current = raw
    for (let hop = 0; hop < 3; hop += 1) {
      await assertPublicUrl(current)
      const res = await fetchImpl(current, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current).toString()
        continue
      }
      if (!res.ok || Number(res.headers.get('content-length') ?? 0) > COVER_MAX_BYTES) return null
      const buffer = Buffer.from(await res.arrayBuffer())
      const ext = buffer.length <= COVER_MAX_BYTES ? sniffImage(buffer) : null
      if (!ext) return null
      const name = `${newId('c')}${ext}`
      await writeFile(join(filesDir, name), buffer)
      return `media-desk/files/${name}`
    }
  } catch { /* the cover is optional */ }
  return null
}

/** Download covers for posts that don't have one yet, returning external id -> local path. */
export async function saveCovers(posts, platform, state, filesDir, fetchImpl = fetch) {
  const known = new Set(state.items.filter(item => item.media?.src && item.externalId).map(item => item.externalId))
  const queue = posts.filter(post => post.cover && !known.has(`${platform}:${post.id}`))
  const saved = new Map()
  const worker = async () => {
    for (let post = queue.shift(); post; post = queue.shift()) {
      const src = await saveCover(post.cover, filesDir, fetchImpl)
      if (src) saved.set(post.id, src)
    }
  }
  await Promise.all(Array.from({ length: COVER_CONCURRENCY }, worker))
  return saved
}

/** Write an imported account's posts into the content library and analytics. A second import only
 * updates the numbers: no duplicates, and no rewriting text the user has edited. Metrics are opt-in
 * because Reddit's Atom feed carries no numbers; the host enables them only for a JSON user import. */
export function importPosts(draft, { account, profile, posts, covers = new Map(), now = new Date().toISOString(), withMetrics = false }) {
  const { platform } = account
  const nickname = profile.nickname || platform
  let added = 0
  for (const post of posts) {
    const externalId = `${platform}:${post.id}`
    let item = draft.items.find(row => row.externalId === externalId)
    if (!item) {
      item = {
        id: newId('it'), kind: 'web', title: post.title, body: post.body, tags: [], status: 'published', personaIds: [], drafts: {},
        createdAt: post.publishedAt, publishedAt: post.publishedAt, scheduledAt: post.publishedAt, platform, url: post.url, source: nickname,
        ...(post.author ? { author: post.author } : {}), media: null, imported: true, externalId,
      }
      draft.items.push(item)
      added += 1
    }
    // A subreddit's posts belong to their authors, so keep that name on the item.
    if (post.author && item.author !== post.author) item.author = post.author
    if (covers.has(post.id)) item.media = { src: covers.get(post.id) }
    // Reddit's Atom feed has no public view or like counts, so analytics stay manual or CSV-driven there.
    if (withMetrics && Number.isFinite(post.likes) && Number.isFinite(post.comments)) {
      const numbers = { views: post.views, likes: post.likes, comments: post.comments, shares: post.shares, saves: post.saves }
      const metric = draft.metrics.find(row => row.externalId === externalId)
      if (metric) Object.assign(metric, numbers, { fetchedAt: now })
      else draft.metrics.push({ id: newId('m'), itemId: item.id, platform, date: post.publishedAt, ...numbers, externalId, fetchedAt: now })
    }
  }
  const key = `${platform}:${account.id}`
  const row = draft.accounts.find(entry => entry.externalId?.toLowerCase() === key.toLowerCase())
  const fields = { platform, handle: nickname, url: account.url, followers: profile.followers || null, description: profile.description, fetchedAt: now, fetchError: null }
  if (row) Object.assign(row, fields)
  else draft.accounts.push({ id: newId('ac'), createdAt: now, externalId: key, ...fields })
  return { added, updated: posts.length - added }
}

/** Material for style extraction. The most engaging posts come first, because the model weighs the opening more. */
export function postsToMaterial(posts) {
  const score = post => (Number(post.likes) || 0) + (Number(post.comments) || 0) + (Number(post.saves) || 0) + (Number(post.shares) || 0)
  return [...posts]
    .sort((a, b) => ((Number(b.views) || 0) - (Number(a.views) || 0)) || (score(b) - score(a)))
    .map(post => (post.body && !post.body.startsWith(post.title) ? `${post.title}\n${post.body}` : post.body || post.title))
    .join('\n\n---\n\n')
}

function normalizedPost({ id, body = '', publishedAt, url, author, cover }) {
  const time = typeof publishedAt === 'number' ? publishedAt : Date.parse(publishedAt)
  if (!Number.isFinite(time) || time <= 0 || time > 8.64e15) return null
  const caption = typeof body === 'string' ? body.trim().slice(0, 4000) : ''
  return { id, body: caption, title: caption.split('\n')[0].slice(0, 100) || tr('Untitled'), publishedAt: new Date(time).toISOString(), url, author, cover }
}

function profileEntries(payload) {
  const timeline = payload?.data?.user?.result?.timeline?.timeline
    ?? payload?.data?.user_result_by_screen_name?.result?.timeline?.timeline
    ?? payload?.timeline
  if (timeline?.instructions) return timeline.instructions.flatMap(row => row.entries ?? [])
  // X has used several wrapper keys around the same timeline.
  for (const value of Object.values(payload ?? {})) {
    if (value && typeof value === 'object') {
      const entries = profileEntries(value)
      if (entries.length) return entries
    }
  }
  return []
}

export function parsePublicX(html, handle) {
  const posts = new Map()
  for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!script.includes('TimelineAddEntries')) continue
    for (const [literal] of script.matchAll(/"(?:[^"\\]|\\.)*"/gs)) {
      if (!literal.includes('TimelineAddEntries')) continue
      let data
      try { data = JSON.parse(JSON.parse(literal)) } catch { continue }
      for (const entry of profileEntries(data)) {
        const item = (entry?.content?.itemContent ?? entry?.content?.content)?.tweet_results?.result
        const tweet = item?.__typename === 'TweetWithVisibilityResults' ? item.tweet : item
        const user = tweet?.core?.user_results?.result
        const author = user?.core?.screen_name ?? user?.legacy?.screen_name
        const id = tweet?.rest_id
        if (typeof author !== 'string' || author.toLowerCase() !== handle.toLowerCase() || !/^\d{10,25}$/.test(id ?? '')) continue
        const content = Object.values(tweet).find(value => typeof value?.full_text === 'string')
        const body = tweet.note_tweet?.note_tweet_results?.result?.text ?? content?.full_text
        const post = normalizedPost({ id, body, publishedAt: content?.created_at_ms ?? content?.created_at, url: `https://x.com/${handle}/status/${id}`, author })
        if (post) posts.set(id, post)
        if (posts.size === 25) return [...posts.values()]
      }
    }
  }
  return [...posts.values()]
}

async function boundedText(response, limit) {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) return text + decoder.decode()
      size += value.byteLength
      if (size > limit) throw new Error(tr('The platform response was too large'))
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
}

export async function fetchPublicX(account, fetchImpl = fetch) {
  const response = await fetchImpl(account.url, {
    redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html' },
  })
  if (!response.ok) throw new Error(tr('X public profile returned HTTP {status}', { status: response.status }))
  const posts = parsePublicX(await boundedText(response, 4 * 1024 * 1024), account.id)
  if (!posts.length) throw new Error(tr('X did not expose recent public posts. The profile may be private, empty, or showing a login screen.'))
  return { posts, profile: { nickname: '@' + account.id }, via: 'public' }
}

export async function fetchInstagram(account, token, fetchImpl = fetch) {
  if (!token) throw new Error(tr('Add an Instagram access token to link this account.'))
  const get = async path => {
    const response = await fetchImpl('https://graph.instagram.com/' + path, {
      redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { authorization: 'Bearer ' + token },
    })
    if (!response.ok) {
      throw new Error(tr('Instagram returned HTTP {status}. Check the token and its instagram_business_basic permission.', { status: response.status }))
    }
    return JSON.parse(await boundedText(response, 1024 * 1024))
  }
  const user = await get('me?fields=id,username')
  if (typeof user.username !== 'string' || user.username.toLowerCase() !== account.id.toLowerCase()) {
    throw new Error(tr('The token belongs to a different Instagram account.'))
  }
  const result = await get('me/media?fields=id,caption,permalink,timestamp,media_type,media_url,thumbnail_url,like_count,comments_count&limit=25')
  if (!Array.isArray(result.data)) throw new Error(tr('Instagram did not return a media listing.'))
  const posts = []
  for (const row of result.data.slice(0, 25)) {
    const url = URL.canParse(row?.permalink) ? new URL(row.permalink) : null
    const id = url?.protocol === 'https:' && ['www.instagram.com', 'instagram.com'].includes(url.hostname)
      && !url.username && !url.password && !url.port && /^\/(?:p|reel|tv)\/([\w-]{5,40})\/?$/.exec(url.pathname)?.[1]
    if (!id) continue
    const cover = row.media_type === 'VIDEO' ? row.thumbnail_url : row.media_url
    const post = normalizedPost({ id, body: row.caption, publishedAt: row.timestamp, url: url.origin + url.pathname, author: user.username, cover })
    if (!post) continue
    if (Number.isFinite(row.like_count) && Number.isFinite(row.comments_count)) {
      Object.assign(post, { likes: row.like_count, comments: row.comments_count, views: 0, saves: 0, shares: 0 })
    }
    posts.push(post)
  }
  return { posts, profile: { nickname: '@' + user.username }, via: 'meta', withMetrics: true }
}
