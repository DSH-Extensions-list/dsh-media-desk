// The host half of dsh-media-desk: /media-desk/* routes, file serving and model calls.
import { createReadStream } from 'node:fs'
import { execFile } from 'node:child_process'
import { stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { callModel, chatPrompts, extractJson, modelInfo, modelStatus } from './ai.js'
import { defaultExportDir, resolveExportDir, saveProduction } from './export.js'
import { harvest, harvestText } from './harvest.js'
import { generateImage } from './images.js'
import { localIntent } from './intents.js'
import { computeInsights, exportSkill, proposeRules } from './learn.js'
import { fetchInstagram, fetchPublicX, importPosts, postsToMaterial, resolveAccount, saveCovers } from './social.js'
import { Connections } from './connections.js'
import { applyOps, newId } from './ops.js'
import { applyRevision, Producer } from './produce.js'
import { fetchRedditFeed, parseRedditSource } from './reddit.js'
import { publicSettings, Settings, imageReady } from './settings.js'
import { normalizeStyle, stylePrompts } from './style.js'
import { dshHome, Store } from './store.js'
import { tr } from './i18n.js'

const ASSETS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets')
const MAX_JSON = 4_000_000
const MAX_UPLOAD = 250_000_000
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' }
const UPLOAD_EXT = Object.fromEntries(Object.entries(MIME).filter(([ext]) => ext !== '.jpeg').map(([ext, type]) => [type, ext]))

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readBuffer(req, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw Object.assign(new Error(tr('The content is too large')), { status: 413 })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readJson(req) {
  const raw = await readBuffer(req, MAX_JSON)
  if (!raw.length) return {}
  try {
    return JSON.parse(raw.toString('utf8'))
  } catch {
    throw Object.assign(new Error(tr('The request is not valid JSON')), { status: 400 })
  }
}

/** Range support, so videos can scrub and loop properly. */
async function sendFile(req, res, file) {
  const type = MIME[extname(file).toLowerCase()]
  if (!type) return json(res, 404, { error: tr('Unsupported file type') })
  let info
  try {
    info = await stat(file)
  } catch {
    return json(res, 404, { error: tr('File not found') })
  }
  res.setHeader('content-type', type)
  res.setHeader('accept-ranges', 'bytes')
  res.setHeader('cache-control', 'private, max-age=3600')
  res.setHeader('x-content-type-options', 'nosniff')
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1
    if (start >= info.size || start > end) {
      res.statusCode = 416
      res.setHeader('content-range', `bytes */${info.size}`)
      return res.end()
    }
    res.statusCode = 206
    res.setHeader('content-range', `bytes ${start}-${end}/${info.size}`)
    res.setHeader('content-length', end - start + 1)
    return createReadStream(file, { start, end }).pipe(res)
  }
  res.statusCode = 200
  res.setHeader('content-length', info.size)
  if (req.method === 'HEAD') return res.end()
  return createReadStream(file).pipe(res)
}

function engineLabel(ctx) {
  const info = modelInfo(ctx)
  return info ? info.label : null
}

/** Report an outage once per failure, in plain words. The raw error goes in the model status tooltip. */
function outageNotice(ctx, wasDown, fallback) {
  if (wasDown) return null
  return modelInfo(ctx) ? tr('The model is unavailable right now, so {fallback}. You can check your account or key in settings.', { fallback }) : tr('No model is connected, so {fallback}.', { fallback })
}

async function chatTurn(ctx, store, desk, body) {
  const message = String(body.message || '').trim()
  if (!message) throw Object.assign(new Error(tr('The message is empty')), { status: 400 })
  const focusId = typeof body.focusId === 'string' ? body.focusId : undefined
  const state = await store.read()
  const snapshot = JSON.parse(JSON.stringify(state))
  let plan
  let engine = 'local'
  let notice = null
  const wasDown = modelStatus.ok === false
  try {
    const history = snapshot.chat.filter(row => (row.itemId ?? null) === (focusId ?? null))
    const { system, user } = chatPrompts(snapshot, message, { focusId, history })
    const editing = snapshot.items.find(row => row.id === focusId)?.production?.status === 'done'
    const { text, model } = await callModel(ctx, { system, user, maxTokens: editing ? 8000 : 2000, light: true, signal: AbortSignal.timeout(editing ? 240_000 : 90_000) })
    engine = model
    try {
      plan = extractJson(text)
      if (typeof plan.reply !== 'string') plan.reply = tr('Done.')
    } catch {
      // A model that replies with plain prose is answering, not failing
      plan = { reply: text.trim().slice(0, 1200) || tr('I didn\'t catch that. Could you put it another way?'), ops: [] }
    }
  } catch {
    notice = outageNotice(ctx, wasDown, tr('I used local rules instead'))
    plan = localIntent(snapshot, message, { focusId })
  }
  const settings = await desk.settings.read()
  const canDraw = imageReady(settings)
  // Only a step that changed data earns an undo slot; asking a question does not
  const changed = await store.mutate(tr('Chat: {text}', { text: message.slice(0, 18) }), (draft) => {
    const target = focusId ? draft.items.find(row => row.id === focusId) : null
    const production = target?.production?.status === 'done' ? target.production : null
    // Local rules only touch the idea title; once there's a draft, its title is the one to change
    const ops = (Array.isArray(plan.ops) ? plan.ops : []).map((op) => {
      if (production && op?.op === 'update_item' && op.id === focusId && typeof op.title === 'string') return { op: 'update_production', id: focusId, title: op.title }
      return op
    })
    const { receipts, errors } = applyOps(draft, ops)
    let targets = []
    if (production && plan.revise) {
      // Without an image model nothing gets redrawn, so the receipt should say so
      const revision = applyRevision(production, plan.revise, { canDraw })
      receipts.push(...revision.receipts.map(text => ({ text })))
      errors.push(...revision.errors)
      targets = canDraw ? revision.targets : []
    }
    return { receipts, errors, targets, done: Boolean(production) }
  })
  const result = await store.mutate('Chat log', (draft) => {
    const { receipts, errors, targets, done } = changed
    const at = new Date().toISOString()
    const itemId = focusId ?? undefined
    // A finished draft isn't rebuilt from one message; that's what Redraft is for
    const actions = (Array.isArray(plan.actions) ? plan.actions : [])
      .filter(a => a && ['produce', 'open', 'nav'].includes(a.type))
      .filter(a => !(a.type === 'produce' && (done && a.id === focusId || draft.items.find(row => row.id === a.id)?.production?.status === 'done')))
    draft.chat.push({ id: newId('c'), at, role: 'user', text: message, itemId })
    const answer = { id: newId('c'), at, role: 'assistant', text: plan.reply, receipts, errors, engine, notice, undoable: receipts.length > 0, itemId }
    draft.chat.push(answer)
    draft.chat = draft.chat.slice(-300)
    return { answer, actions, targets, state: draft, modelOk: modelStatus.ok, modelError: modelStatus.error }
  }, { undoable: false })
  if (canDraw) {
    await Promise.all(result.targets.map(target => desk.producer.regenerate(focusId, target).catch(() => {})))
    return { ...result, state: await store.read() }
  }
  return result
}

async function extractStyle(ctx, store, body) {
  const urls = (Array.isArray(body.urls) ? body.urls : []).map(row => String(row).trim()).filter(Boolean).slice(0, 5)
  const parts = [String(body.text ?? '').trim()].filter(Boolean)
  const failures = []
  for (const url of urls) {
    try {
      const page = await harvestText(url)
      if (page.text.length >= 80) parts.push(`${page.title ?? ''}\n${page.text}`)
      else failures.push(tr('{url}: there is almost no text on the page. It may require sign-in.', { url }))
    } catch (err) {
      failures.push(tr('{url}: {error}', { url, error: err.message }))
    }
  }
  const material = parts.join('\n\n---\n\n')
  if (material.length < 80) {
    throw Object.assign(new Error(failures.length ? tr('Couldn\'t get the content. {reason}. You can paste the text in directly.', { reason: failures[0] }) : tr('That is too little text. Paste at least one full paragraph.')), { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 20) : ''
  const source = urls.length && parts.length === urls.length ? tr('Link') : urls.length ? tr('Text and links') : tr('Content')
  return styleFromMaterial(ctx, store, { material, name, source, sourceUrls: urls, failures })
}

/** Learn a style card and make it active. Re-importing the same account updates the existing card. */
async function styleFromMaterial(ctx, store, { material, name, source, sourceUrls = [], failures = [], accountKey = null }) {
  let style
  try {
    const { system, user } = stylePrompts(material, name)
    const { text } = await callModel(ctx, { system, user, maxTokens: 1500, light: true, signal: AbortSignal.timeout(120_000) })
    style = normalizeStyle(extractJson(text), name)
  } catch (err) {
    throw Object.assign(new Error(tr('Learning a style needs a text model: {error}', { error: err.message })), { status: 502 })
  }
  return store.mutate(tr('Learn style "{name}"', { name: style.name }), (draft) => {
    const existing = accountKey ? (draft.styles ?? []).find(row => row.accountKey === accountKey) : null
    const id = existing?.id ?? newId('st')
    const row = { id, ...style, source, sourceUrls, ...(accountKey ? { accountKey } : {}), createdAt: existing?.createdAt ?? new Date().toISOString() }
    draft.styles = existing ? draft.styles.map(entry => (entry.id === id ? row : entry)) : [row, ...(draft.styles ?? [])]
    draft.activeStyleId = id
    return { id, failures, state: draft }
  })
}

/** Learn a style from an imported account without letting a model failure undo the import. */
async function learnImportedStyle(ctx, store, { account, profile, posts }) {
  const nickname = profile.nickname || account.platform
  const material = postsToMaterial(posts)
  if (material.length < 80) return { nickname, styleError: tr('This account doesn\'t have enough text to learn a style from.') }
  try {
    await styleFromMaterial(ctx, store, { material, name: nickname, source: tr('{platform} account', { platform: account.platform }), sourceUrls: [account.url], accountKey: `${account.platform}:${account.id}` })
    return { nickname, styleError: null }
  } catch (err) {
    return { nickname, styleError: err.message }
  }
}

function importBusy(desk) {
  if (desk.importing) throw Object.assign(new Error(tr('Another account is still importing. Try again when it finishes.')), { status: 409 })
}

async function readSocialPosts(account) {
  if (account.platform === 'X') return fetchPublicX(account)
  if (account.platform === 'Instagram') return fetchInstagram(account, account.token)
  const { posts, via } = await fetchRedditFeed({ ...account, id: account.id.slice(2) })
  if (!posts.length) throw Object.assign(new Error(tr('No public posts found for this Reddit source.')), { status: 404 })
  const withMetrics = account.kind === 'user' && via === 'json'
  return {
    posts: withMetrics ? posts.map(post => ({ ...post, views: 0, likes: post.score, comments: post.comments, shares: 0, saves: 0 })) : posts,
    profile: { nickname: account.id }, via, withMetrics,
  }
}

async function syncSource(ctx, store, desk, account, { automatic = false } = {}) {
  importBusy(desk)
  desk.importing = true
  const key = account.platform + ':' + account.id.toLowerCase()
  try {
    const { posts, profile, via, withMetrics } = await readSocialPosts(account)
    const covers = account.platform === 'Instagram' ? await saveCovers(posts, account.platform, await store.read(), store.filesDir) : undefined
    const added = await store.mutate(tr('Import {platform} posts', { platform: account.platform }), draft =>
      importPosts(draft, { account, profile, posts, covers, withMetrics }).added, { undoable: !automatic })
    if (!automatic) await desk.connections.save(account)
    await desk.connections.record(key, { at: Date.now(), error: null })
    // Background refreshes should never spend model quota or change the active writing style.
    const style = automatic || !added ? {} : await learnImportedStyle(ctx, store, { account, profile, posts })
    return {
      platform: account.platform, kind: account.kind, via, nickname: profile.nickname, count: posts.length, added,
      styleError: style.styleError, styleName: style.styleError === null ? profile.nickname : null, state: await store.read(),
    }
  } catch (error) {
    // Provider responses are untrusted and must never expose credentials in status or browser errors.
    const message = account.token ? String(error.message).split(account.token).join('[redacted]') : String(error.message)
    await desk.connections.record(key, { at: Date.now(), error: message })
    throw Object.assign(new Error(message), { status: error.status })
  } finally {
    desk.importing = false
  }
}

async function importAccountRoute(ctx, store, desk, body) {
  importBusy(desk)
  const rows = await desk.connections.read()
  if (typeof body.key === 'string') {
    const saved = rows.find(row => row.key === body.key)
    if (!saved) throw Object.assign(new Error(tr('This connection no longer exists.')), { status: 404 })
    return syncSource(ctx, store, desk, saved)
  }
  const text = String(body.text ?? '')
  const reddit = parseRedditSource(text)
  const account = reddit ? { ...reddit, id: (reddit.kind === 'subreddit' ? 'r/' : 'u/') + reddit.id } : await resolveAccount(text)
  const existing = rows.find(row => row.key === account.platform + ':' + account.id.toLowerCase())
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (account.platform === 'Instagram') {
    if (token && !/^[A-Za-z0-9._|~-]{1,4096}$/.test(token)) {
      throw Object.assign(new Error(tr('Enter a valid Instagram access token.')), { status: 400 })
    }
    account.token = token || existing?.token
    if (!account.token) throw Object.assign(new Error(tr('Add an Instagram access token to link this account.')), { status: 400 })
  }
  account.auto = typeof body.auto === 'boolean' ? body.auto : existing?.auto !== false
  return syncSource(ctx, store, desk, account)
}

async function refreshDue(ctx, store, desk) {
  if (desk.importing || desk.stopping) return
  for (const account of await desk.connections.due(Date.now())) {
    if (desk.importing || desk.stopping) return
    // Re-read after each import so an account disconnected during the previous request stays disconnected.
    const current = (await desk.connections.read()).find(row => row.key === account.key)
    if (!current || current.auto === false || current.lastAttemptAt !== account.lastAttemptAt) continue
    await syncSource(ctx, store, desk, current, { automatic: true }).catch(() => {})
  }
}

async function addFromUrl(ctx, store, body) {
  const url = String(body.url || '').trim()
  const info = await harvest(url)
  const op = {
    op: 'add_item', kind: 'web', title: body.title || info.title || url, body: body.note || info.description || '', url: info.url, source: info.siteName, tags: Array.isArray(body.tags) ? body.tags : [],
    media: info.image ? { src: info.image } : null,
  }
  return store.mutate(tr('Save "{title}"', { title: op.title.slice(0, 12) }), (draft) => {
    const { receipts, errors } = applyOps(draft, [op])
    return { receipts, errors, id: receipts[0]?.target, state: draft }
  })
}

async function refreshAccount(store, body) {
  const url = String(body.url || '').trim()
  const now = new Date().toISOString()
  let patch
  try {
    const info = await harvest(url)
    patch = { url: info.url, title: info.title ?? undefined, description: info.description ?? undefined, avatar: info.image ?? undefined, fetchedAt: now, fetchError: '', ...(info.followers ? { followers: info.followers } : {}) }
  } catch (err) {
    patch = { url, fetchedAt: now, fetchError: err.message }
  }
  return store.mutate(tr('Update account profile'), (draft) => {
    const op = body.id ? { op: 'update_account', id: body.id, ...patch } : { op: 'add_account', platform: body.platform ?? '', handle: body.handle ?? '', ...patch }
    const { errors } = applyOps(draft, [op])
    return { state: draft, errors, fetchError: patch.fetchError || null }
  })
}

async function handleUpload(req, store, res) {
  const type = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
  const ext = UPLOAD_EXT[type]
  if (!ext) return json(res, 415, { error: tr('Unsupported file: {type}', { type: type || tr('unknown') }) })
  const buffer = await readBuffer(req, MAX_UPLOAD)
  await store.read()
  const name = `${newId('f')}${ext}`
  await writeFile(join(store.filesDir, name), buffer)
  return json(res, 200, { src: `media-desk/files/${name}`, kind: type.startsWith('video/') ? 'video' : 'image' })
}

async function route(ctx, store, desk, req, res) {
  const url = new URL(req.url || '/', 'http://local')
  const path = url.pathname.replace(/^\/media-desk\/?/, '')
  const method = req.method || 'GET'

  if ((method === 'GET' || method === 'HEAD') && path.startsWith('assets/')) {
    const name = path.slice('assets/'.length)
    if (!/^[\w.-]+$/.test(name)) return json(res, 400, { error: tr('Invalid path') })
    return sendFile(req, res, join(ASSETS_DIR, name))
  }
  if ((method === 'GET' || method === 'HEAD') && path.startsWith('files/')) {
    const name = path.slice('files/'.length)
    if (!/^[\w.-]+$/.test(name)) return json(res, 400, { error: tr('Invalid path') })
    await store.read()
    return sendFile(req, res, join(store.filesDir, name))
  }
  if (method === 'GET') {
    if (path === 'state') {
      if (!desk.settled) { desk.settled = true; await desk.producer.settleAll().catch(() => {}) }
      const state = await store.read()
      return json(res, 200, { state, model: engineLabel(ctx), modelOk: modelStatus.ok, modelError: modelStatus.error, canUndo: store.undo.length > 0 })
    }
    if (path === 'production') {
      const id = url.searchParams.get('id') ?? ''
      await desk.producer.settle(id)
      const state = await store.read()
      const item = state.items.find(row => row.id === id)
      return json(res, 200, { production: item?.production ?? null, status: item?.status, live: desk.producer.status(id) })
    }
    if (path === 'settings') return json(res, 200, { ...publicSettings(await desk.settings.read()), defaultExportDir: defaultExportDir() })
    if (path === 'insights') return json(res, 200, computeInsights(await store.read()))
    if (path === 'accounts') return json(res, 200, { connections: await desk.connections.list() })
    return json(res, 404, { error: tr('Not found') })
  }
  if (method !== 'POST') return json(res, 405, { error: tr('Method not allowed') })

  // Every write rejects cross-site requests
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none') return json(res, 403, { error: tr('Cross-site request refused') })

  if (path === 'upload') return handleUpload(req, store, res)
  const body = await readJson(req)
  switch (path) {
    case 'ops': {
      const label = typeof body.label === 'string' ? body.label : tr('Action')
      const result = await store.mutate(label, (draft) => {
        const applied = applyOps(draft, body.ops)
        return { ...applied, state: draft }
      }, { undoable: body.undoable !== false })
      return json(res, 200, result)
    }
    case 'undo': {
      const label = await store.undoLast()
      return json(res, 200, { label, state: await store.read(), canUndo: store.undo.length > 0 })
    }
    case 'chat': return json(res, 200, await chatTurn(ctx, store, desk, body))
    case 'chat/clear': {
      const state = await store.mutate('Clear chat', (draft) => { draft.chat = []; return draft }, { undoable: false })
      return json(res, 200, { state })
    }
    case 'produce': {
      const started = await desk.producer.start(String(body.id))
      return json(res, 200, { started, state: await store.read() })
    }
    case 'produce/cancel':
      await desk.producer.cancel(String(body.id))
      return json(res, 200, { ok: true })
    case 'produce/regen':
      await desk.producer.regenerate(String(body.id), body.target)
      return json(res, 200, { state: await store.read() })
    case 'produce/save': {
      const settings = await desk.settings.read()
      const state = await store.read()
      const item = state.items.find(row => row.id === body.id)
      if (!item?.production?.article) return json(res, 400, { error: tr('Nothing drafted to save yet') })
      await store.read()
      // The browser composites the video cover (big text over the frame), so accept JPEG only here
      const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body.videoCover ?? '')
      const videoCover = match ? Buffer.from(match[1], 'base64') : null
      if (videoCover && !(videoCover[0] === 0xff && videoCover[1] === 0xd8)) return json(res, 400, { error: tr('The cover isn\'t a valid image') })
      const saved = await saveProduction(item.production, { filesDir: store.filesDir, exportDir: resolveExportDir(settings.exportDir), videoCover })
      const next = await store.mutate('Save draft', (draft) => {
        const target = draft.items.find(row => row.id === body.id)
        if (target?.production) {
          target.production.savedPath = saved.path
          target.production.savedAt = new Date().toISOString()
        }
        return draft
      }, { undoable: false })
      return json(res, 200, { ...saved, state: next })
    }
    case 'produce/reveal': {
      // Take the path from the saved record only, never from the request
      const state = await store.read()
      const path = state.items.find(row => row.id === body.id)?.production?.savedPath
      if (!path) return json(res, 400, { error: tr('Not saved yet') })
      const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'
      execFile(command, [path], () => {})
      return json(res, 200, { path })
    }
    case 'style/extract': return json(res, 200, await extractStyle(ctx, store, body))
    case 'accounts/import': return json(res, 200, await importAccountRoute(ctx, store, desk, body))
    case 'accounts/disconnect': {
      importBusy(desk)
      await desk.connections.remove(String(body.key ?? ''))
      return json(res, 200, { connections: await desk.connections.list() })
    }
    case 'accounts/automatic': {
      importBusy(desk)
      const row = (await desk.connections.read()).find(entry => entry.key === body.key)
      if (!row || typeof body.auto !== 'boolean') return json(res, 400, { error: tr('Choose a saved connection and a refresh preference.') })
      await desk.connections.setAutomatic(row.key, body.auto)
      return json(res, 200, { connections: await desk.connections.list() })
    }
    case 'settings':
      return json(res, 200, { ...publicSettings(await desk.settings.update(body)), defaultExportDir: defaultExportDir() })
    case 'settings/test': {
      const settings = await desk.settings.read()
      if (!imageReady(settings)) return json(res, 400, { error: tr('Fill in the endpoint, model and key first') })
      await store.read()
      const { buffer, ext } = await generateImage(settings.image, 'A single paper boat on calm water, black and white pencil line art sketch, plain white paper background, no text.')
      const name = `${newId('t')}${ext}`
      await writeFile(join(store.filesDir, name), buffer)
      return json(res, 200, { src: `media-desk/files/${name}` })
    }
    case 'capture-url': return json(res, 200, await addFromUrl(ctx, store, body))
    case 'account/refresh': return json(res, 200, await refreshAccount(store, body))
    case 'skills/learn': {
      const proposals = proposeRules(await store.read())
      if (!proposals.length) return json(res, 200, { added: 0, state: await store.read() })
      const state = await store.mutate(tr('Learn from data'), (draft) => {
        // Rules learned from sample data are samples too: cleared with the rest and never exported
        const fromSamples = !draft.metrics.some(metric => !metric.sample)
        const { receipts } = applyOps(draft, proposals.map(row => ({ op: 'add_skill', ...row, status: 'proposed' })))
        if (fromSamples) for (const receipt of receipts) { const skill = draft.skills.find(row => row.id === receipt?.target); if (skill) skill.sample = true }
        return draft
      })
      return json(res, 200, { added: proposals.length, state })
    }
    case 'skills/export': {
      const state = await store.read()
      const result = await exportSkill(state, dshHome())
      const next = await store.mutate('Export Skill', (draft) => {
        applyOps(draft, draft.skills.filter(s => !s.sample && s.status === 'active').map(s => ({ op: 'update_skill', id: s.id, status: 'exported' })))
        return draft
      }, { undoable: false })
      return json(res, 200, { ...result, state: next })
    }
    default: return json(res, 404, { error: tr('Not found') })
  }
}

/**
 * The web server doesn't authenticate plugin routes, so every request has to run
 * the Host/Origin and login checks itself. Refuse when the auth service is missing.
 * @param {object} ctx - Cordis context.
 * @param {{headers: object}} req - HTTP request.
 * @returns {number|undefined} Status code when refusing; undefined to continue.
 */
export function requestRejection(ctx, req) {
  const connection = ctx.get('connection')
  if (typeof connection?.requestRejection !== 'function') return 403
  return connection.requestRejection({ headers: req.headers })
}

export const name = 'dsh-media-desk'

export default {
  inject: ['webServer', 'connection'],
  apply(ctx) {
    const store = new Store()
    const settings = new Settings(store.root)
    const producer = new Producer({ store, settings, callText: options => callModel(ctx, options), generate: generateImage })
    const desk = { settings, producer, connections: new Connections(store.root) }
    ctx.effect(() => {
      const refresh = () => { void refreshDue(ctx, store, desk).catch(() => {}) }
      const startup = setTimeout(refresh, 15_000)
      const interval = setInterval(refresh, 60_000)
      startup.unref()
      interval.unref()
      return () => {
        desk.stopping = true
        clearTimeout(startup)
        clearInterval(interval)
      }
    }, 'dsh-media-desk: linked account refresh')
    ctx.effect(() => ctx.webServer.register({
      kind: 'prefix',
      path: '/media-desk',
      handler: async (req, res) => {
        try {
          const rejection = requestRejection(ctx, req)
          if (rejection) {
            json(res, rejection, { error: tr('Not authorized') })
            return
          }
          await route(ctx, store, desk, req, res)
        } catch (err) {
          if (res.headersSent) {
            res.end()
            return
          }
          json(res, err.status || 500, { error: err.message })
        }
      },
    }), 'dsh-media-desk: /media-desk routes')
  },
}
