// Account import: read public content and engagement numbers through the Monid CLI the user installed.
// Monid keeps the key itself; this code only invokes the command and never reads or stores the key.
// Every call spends the user's balance, so the endpoints and counts below are hard-coded.
import { execFile } from 'node:child_process'
import { access, constants, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { assertPublicUrl } from './harvest.js'
import { newId } from './ops.js'
import { tr } from './i18n.js'

const POST_COUNT = 20
const RUN_WAIT_SECONDS = 120
const MAX_OUTPUT = 64 * 1024 * 1024
const COVER_MAX_BYTES = 8 * 1024 * 1024
const COVER_CONCURRENCY = 4

export const MONID_SKILL_URL = 'https://monid.ai/SKILL.md'

// Keyed by the stored platform value, which is the English platform name.
const SOURCES = {
  // Instagram needs a numeric user id first, which is looked up from the username, before posts can be read
  Instagram: {
    profileFirst: true,
    query: (id, kind, profile) => (kind === 'posts' ? { user_id: profile?.data?.user?.id, count: Math.min(POST_COUNT, 50) } : { username: id }),
    calls: {
      profile: '/api/v1/instagram/v1/fetch_user_info_by_username',
      posts: '/api/v1/instagram/v1/fetch_user_posts',
    },
  },
  // X's post endpoint returns the account profile too, so one call is enough
  X: {
    query: id => ({ screen_name: id }),
    calls: {
      posts: '/api/v1/twitter/web/fetch_user_post_tweet',
    },
  },
}

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
 * Read the platform and account id out of a profile link. The id is passed to the command line,
 * so only fixed formats are accepted.
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
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
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
 * before this runs; this function covers the two Monid platforms. */
export async function resolveAccount(text) {
  const first = findUrl(text)
  if (!first) throw Object.assign(new Error(tr('No link found. Paste the URL of the account\'s profile page.')), { status: 400 })
  const account = parseAccountUrl(first)
  if (account) return account
  throw Object.assign(new Error(tr('This profile link isn\'t recognized. Instagram, X and Reddit profiles are supported. For other platforms, paste your posts to learn a style.')), { status: 400 })
}

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function count(value) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function isoFromSeconds(value) {
  return Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : new Date().toISOString()
}

function httpsUrl(value) {
  if (typeof value !== 'string' || !value) return null
  const url = value.startsWith('//') ? `https:${value}` : value.replace(/^http:\/\//, 'https://')
  return url.startsWith('https://') ? url : null
}

function firstLine(value, fallback) {
  const line = text(value, 300).split('\n').find(row => row.trim())?.trim() ?? ''
  return line.slice(0, 40) || fallback
}

function assertOk(platform, output) {
  const failed = platform === 'Instagram'
    ? !Array.isArray(output?.items ?? output?.data?.items)
    : !Array.isArray(output?.timeline)
  if (failed) throw new Error(text(output?.status_msg ?? output?.msg ?? output?.message, 120) || tr('The platform returned nothing'))
}

/** Third-party responses are untrusted: keep only the fields we use and cap their length. */
export function normalizePosts(platform, output) {
  if (platform !== 'Instagram' && platform !== 'X') return []
  assertOk(platform, output)
  if (platform === 'Instagram') {
    return (output?.items ?? output?.data?.items ?? []).filter(row => /^[\w-]{5,40}$/.test(row?.code ?? '')).map((row) => {
      const body = text(row.caption?.text, 2000)
      return {
        id: row.code, title: firstLine(body, tr('Untitled')), body, publishedAt: isoFromSeconds(row.taken_at),
        url: `https://www.instagram.com/p/${row.code}/`, cover: httpsUrl(row.image_versions2?.candidates?.[0]?.url ?? row.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url),
        views: count(row.ig_play_count ?? row.play_count ?? row.view_count), likes: count(row.like_count), comments: count(row.comment_count), saves: 0, shares: 0,
      }
    })
  }
  const screen = /^\w{1,15}$/.test(output?.user?.profile ?? '') ? output.user.profile : 'i'
  return (output?.timeline ?? []).filter(row => /^\d+$/.test(row?.tweet_id ?? '')).map((row) => {
    const body = text(row.text, 2000)
    const at = Date.parse(row.created_at)
    const photo = (row.media ?? []).map(m => m?.media_url_https ?? m?.url).find(Boolean)
    return {
      id: row.tweet_id, title: firstLine(body, tr('Untitled')), body, publishedAt: Number.isFinite(at) ? new Date(at).toISOString() : new Date().toISOString(),
      url: `https://x.com/${screen}/status/${row.tweet_id}`, cover: httpsUrl(photo),
      views: count(Number(row.views)), likes: count(row.favorites), comments: count(row.replies), saves: count(row.bookmarks), shares: count(row.retweets) + count(row.quotes),
    }
  })
}

export function normalizeProfile(platform, { profile } = {}) {
  if (platform === 'Instagram') {
    const user = profile?.data?.user ?? {}
    return { nickname: text(user.full_name || user.username, 40), description: text(user.biography, 300), followers: count(user.edge_followed_by?.count ?? user.follower_count) }
  }
  if (platform === 'X') {
    const user = profile ?? {}
    return { nickname: text(user.name, 40), description: text(user.desc, 300), followers: count(user.sub_count ?? user.followers_count) }
  }
  return { nickname: '', description: '', followers: 0 }
}

/** Locate the monid command. An app started from Finder gets a short PATH, so check the usual
 * install locations and then ask a login shell once. */
function createLocator(exec) {
  let cached = null
  const shell = process.env.SHELL || '/bin/zsh'
  const ask = command => new Promise((resolve) => {
    exec(shell, ['-lc', command], { timeout: 8000 }, (err, stdout) => resolve(err ? '' : String(stdout).trim().split('\n').pop() ?? ''))
  })
  return async () => {
    if (cached) return cached
    const home = homedir()
    const dirs = [...(process.env.PATH ?? '').split(delimiter), '/opt/homebrew/bin', '/usr/local/bin', join(home, '.npm-global', 'bin'), join(home, '.local', 'bin'), join(home, '.volta', 'bin'), join(home, '.bun', 'bin')]
    let bin = null
    for (const dir of dirs.filter(Boolean)) {
      try {
        await access(join(dir, 'monid'), constants.X_OK)
        bin = join(dir, 'monid')
        break
      } catch { /* try the next location */ }
    }
    if (!bin) {
      const found = await ask('command -v monid')
      if (found.startsWith('/')) bin = found
    }
    if (!bin) return null
    // The CLI runs on node, so the child process has to find it
    const login = await ask('printf %s "$PATH"')
    cached = { bin, path: [dirname(bin), login, process.env.PATH, '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean).join(delimiter) }
    return cached
  }
}

/** Parse JSON out of the command output. Upgrade notices and similar text may wrap it. */
function parseOutput(stdout) {
  const raw = String(stdout ?? '')
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

/**
 * @param {typeof execFile} [exec] - Replaced in tests.
 * @param {Function} [locate] - Replaced in tests.
 * @returns {(args: string[]) => Promise<object|null>} Runs monid and returns JSON; null when the command isn't installed.
 */
export function createMonidRunner(exec = execFile, locate = createLocator(exec)) {
  return async (args, timeoutSeconds = 30) => {
    const found = await locate()
    if (!found) return null
    return new Promise((resolve, reject) => {
      // No shell in between; arguments go to the command verbatim
      exec(found.bin, args, { timeout: timeoutSeconds * 1000, maxBuffer: MAX_OUTPUT, env: { ...process.env, PATH: found.path, NO_COLOR: '1' } }, (err, stdout, stderr) => {
        const parsed = parseOutput(stdout)
        if (parsed) return resolve(parsed)
        if (err) return reject(new Error(text(String(stderr ?? '') || err.message, 200) || tr('The Monid command failed')))
        return reject(new Error(tr('Couldn\'t read what Monid returned. Try updating the Monid CLI.')))
      })
    })
  }
}

/** Connection state. Neither the key nor account details come back; the UI only learns what to do next. */
export async function monidStatus(run) {
  try {
    const data = await run(['balance', '-j'])
    if (data === null) return { state: 'missing' }
    if (data.error) return data.error.code === 'AUTH_FAILED' ? { state: 'nokey' } : { state: 'error', message: text(data.error.message, 160) }
    const balance = data.balance
    return { state: 'ready', balance: Number.isFinite(balance?.value) ? { value: balance.value, currency: text(balance.currency, 8) || 'USD' } : null }
  } catch (err) {
    return { state: 'error', message: text(err.message, 160) }
  }
}

async function runEndpoint(run, endpoint, query) {
  const data = await run(['run', '-p', 'tikhub', '-e', endpoint, '--query', JSON.stringify(query), '-w', String(RUN_WAIT_SECONDS), '-j'], RUN_WAIT_SECONDS + 30)
  if (data === null) throw Object.assign(new Error(tr('Monid isn\'t installed yet')), { status: 400 })
  if (data.error) {
    const authFailed = data.error.code === 'AUTH_FAILED'
    throw Object.assign(new Error(authFailed ? tr('Monid doesn\'t have an API key yet') : tr('Monid: {message}', { message: text(data.error.message, 160) })), { status: authFailed ? 400 : 502 })
  }
  if (data.status === 'BLOCKED') throw Object.assign(new Error(tr('Monid\'s budget limit blocked this import. Adjust it at app.monid.ai and try again.')), { status: 402 })
  if (data.status !== 'COMPLETED') throw Object.assign(new Error(tr('Monid didn\'t finish this run ({status})', { status: text(data.status, 20) || tr('unknown status') })), { status: 502 })
  return { output: data.output, cost: Number.isFinite(data.cost?.value) ? data.cost.value : 0 }
}

/**
 * Read one page of posts plus the account profile. No paging, and the spend is capped.
 * @returns {Promise<{posts: object[], profile: object, cost: number}>} Posts, profile and the actual cost in USD.
 */
export async function fetchAccount(account, run) {
  const source = SOURCES[account.platform]
  if (!source) throw Object.assign(new Error(tr('This platform can\'t be imported through Monid.')), { status: 400 })
  let profileOutput
  let cost = 0
  if (source.profileFirst) {
    const first = await runEndpoint(run, source.calls.profile, source.query(account.id, 'profile'))
    profileOutput = first.output
    cost += first.cost
  }
  const posts = await runEndpoint(run, source.calls.posts, source.query(account.id, 'posts', profileOutput))
  cost += posts.cost
  const list = normalizePosts(account.platform, posts.output)
  if (!list.length) throw Object.assign(new Error(tr('No posts found. The account may be private or hasn\'t posted yet.')), { status: 404, cost })
  if (account.platform === 'X') profileOutput = posts.output?.user
  return { posts: list, profile: normalizeProfile(account.platform, { profile: profileOutput }), cost }
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
export function importPosts(draft, { account, profile, posts, covers = new Map(), now = new Date().toISOString(), withMetrics = account.platform !== 'Reddit' }) {
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
  const row = draft.accounts.find(entry => entry.externalId === key)
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
