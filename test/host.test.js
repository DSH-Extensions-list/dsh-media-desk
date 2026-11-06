import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { extractJson, fallbackArticle, fallbackPlan } from '../src/ai.js'
import { assertPublicUrl, harvest, harvestText } from '../src/harvest.js'
import { activeStyle, normalizeStyle, stylePrompts, styleToVoice } from '../src/style.js'
import { articlePrompts, planPrompts } from '../src/ai.js'
import { migrateState } from '../src/seed.js'
import { importPosts } from '../src/monid.js'
import { requestRejection } from '../src/host.js'
import { tr } from '../src/i18n.js'
import { localIntent, parseWhen } from '../src/intents.js'
import { computeInsights, exportSkill, proposeRules } from '../src/learn.js'
import { applyOps } from '../src/ops.js'
import { buildSeed } from '../src/seed.js'
import { Store } from '../src/store.js'
import { generateImage } from '../src/images.js'
import { applyRevision, normalizePlan, Producer } from '../src/produce.js'
import { saveProduction, resolveExportDir } from '../src/export.js'
import { chatPrompts } from '../src/ai.js'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { publicSettings, Settings } from '../src/settings.js'
import { stat } from 'node:fs/promises'

const NOW = new Date('2026-10-31T15:00:00+08:00') // Saturday
const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/

function seed() {
  return buildSeed(NOW)
}

test('tr fills {name} placeholders and leaves unknown keys alone', () => {
  assert.equal(tr('Scheduled "{title}" for {when}', { title: 'Slow writing', when: 'Nov 3 20:00' }), 'Scheduled "Slow writing" for Nov 3 20:00')
  assert.equal(tr('Import {platform} account', {}), 'Import {platform} account')
  assert.equal(tr('Done.'), 'Done.')
})

test('parseWhen parses the common English dates and times', () => {
  const at = (text) => {
    const d = parseWhen(text, NOW)
    return d && [d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]
  }
  assert.deepEqual(at('tomorrow 8pm'), [11, 1, 20, 0])
  assert.deepEqual(at('day after tomorrow 9:30am'), [11, 2, 9, 30])
  assert.deepEqual(at('Nov 3 20:00'), [11, 3, 20, 0])
  assert.deepEqual(at('next wed'), [11, 4, 20, 0])
  assert.deepEqual(at('tonight at 9'), [10, 31, 21, 0])
  assert.equal(parseWhen('a sentence with no date', NOW), null)
})

test('localIntent saves a note', () => {
  const plan = localIntent(seed(), 'note: billboard copy on the subway', { now: NOW })
  assert.equal(plan.ops[0].op, 'add_item')
  assert.match(plan.ops[0].body, /^billboard/)
  assert.match(plan.ops[0].title, /^billboard/)
  assert.equal(plan.reply, 'Saved. It\'s on the idea wall.')
  for (const said of ['jot: the same line', 'save: the same line', 'new idea: the same line', 'add an idea: the same line']) {
    assert.equal(localIntent(seed(), said, { now: NOW }).ops[0].body, 'the same line', said)
  }
})

test('localIntent finds a quoted title and schedules it', () => {
  const state = seed()
  const plan = localIntent(state, 'schedule "Slow writing" for tomorrow 8pm on xiaohongshu', { now: NOW })
  const op = plan.ops[0]
  assert.equal(op.op, 'schedule_item')
  assert.equal(op.platform, 'RedNote')
  assert.equal(state.items.find(i => i.id === op.id).title.startsWith('Slow writing'), true)
  const when = new Date(op.scheduledAt)
  assert.deepEqual([when.getMonth() + 1, when.getDate(), when.getHours(), when.getMinutes()], [11, 1, 20, 0])
  assert.equal(plan.reply, 'Scheduled.')
})

test('localIntent leaves everything alone when it cannot find the item', () => {
  const plan = localIntent(seed(), 'schedule "Content that does not exist at all" for tomorrow 8pm', { now: NOW })
  assert.equal(plan.ops.length, 0)
  assert.match(plan.reply, /Which piece should I schedule/)
})

test('localIntent routes article, script and storyboard requests to one-click drafting for the focused card', () => {
  const state = seed()
  for (const said of ['write this as a script', 'turn this into an article', 'make a storyboard for this']) {
    assert.deepEqual(localIntent(state, said, { now: NOW, focusId: 'seed_2' }).actions, [{ type: 'produce', id: 'seed_2' }], said)
  }
})

test('localIntent answers the schedule question in English', () => {
  const state = seed()
  const reply = localIntent(state, 'what\'s on my schedule', { now: NOW }).reply
  assert.match(reply, /^Coming up:/)
  const [receipt] = applyOps(state, [{ op: 'schedule_item', id: 'seed_2', scheduledAt: '2026-11-03T12:00:00Z', platform: 'RedNote' }]).receipts
  assert.match(receipt.text, /^Scheduled ".+" for Nov 3 \d\d:\d\d · RedNote$/)
  const [moved] = applyOps(state, [{ op: 'set_status', id: 'seed_2', status: 'ready' }]).receipts
  assert.match(moved.text, /^Moved ".+" to Ready$/)
})

test('localIntent moves and renames the focused card in English', () => {
  const state = seed()
  assert.deepEqual(localIntent(state, 'move it to ready', { now: NOW, focusId: 'seed_2' }).ops, [{ op: 'set_status', id: 'seed_2', status: 'ready' }])
  assert.deepEqual(localIntent(state, 'rename it to "A better title"', { now: NOW, focusId: 'seed_2' }).ops, [{ op: 'update_item', id: 'seed_2', title: 'A better title' }])
})

test('applyOps rejects unknown operations and prototype-chain names', () => {
  const state = seed()
  const { errors } = applyOps(state, [{ op: 'constructor' }, { op: 'rm_rf' }])
  assert.equal(errors.length, 2)
})

test('applyOps filters illegal fields and dangerous media addresses', () => {
  const state = seed()
  const { receipts } = applyOps(state, [{ op: 'add_item', title: 'x', media: { src: 'javascript:alert(1)' }, url: 'javascript:alert(1)', status: 'nope', evil: 1 }])
  const item = state.items.find(i => i.id === receipts[0].target)
  assert.equal(item.media, undefined)
  assert.equal(item.url, undefined)
  assert.equal(item.status, 'idea')
  assert.equal(item.evil, undefined)
})

test('one failed operation does not affect the rest', () => {
  const state = seed()
  const { receipts, errors } = applyOps(state, [{ op: 'set_status', id: 'nope', status: 'draft' }, { op: 'set_status', id: 'seed_2', status: 'draft' }])
  assert.equal(errors.length, 1)
  assert.equal(receipts.length, 1)
  assert.equal(state.items.find(i => i.id === 'seed_2').status, 'draft')
})

test('deleting a parent card reattaches its children one level up', () => {
  const state = seed()
  applyOps(state, [{ op: 'update_item', id: 'seed_2', parentId: 'seed_1' }, { op: 'update_item', id: 'seed_3', parentId: 'seed_2' }, { op: 'delete_item', id: 'seed_2' }])
  assert.equal(state.items.find(i => i.id === 'seed_3').parentId, 'seed_1')
})

test('clear_samples removes samples but keeps user content', () => {
  const state = seed()
  applyOps(state, [{ op: 'add_item', title: 'My own idea' }, { op: 'clear_samples' }])
  assert.deepEqual(state.items.map(i => i.title), ['My own idea'])
  assert.equal(state.metrics.length, 0)
})

test('Store persists, undoes, and notices writes from another process', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'media-desk-'))
  try {
    const a = new Store(dir)
    const before = (await a.read()).items.length
    await a.mutate('add', s => applyOps(s, [{ op: 'add_item', title: 'New idea' }]))
    assert.equal((await a.read()).items.length, before + 1)
    assert.equal(await a.undoLast(), 'add')
    assert.equal((await a.read()).items.length, before)

    // Let the file mtime advance, so the first Store can tell the file changed
    await new Promise(r => setTimeout(r, 20))
    const b = new Store(dir)
    await b.mutate('b', s => applyOps(s, [{ op: 'add_item', title: 'From the desktop app' }]))
    assert.equal((await a.read()).items[0].title, 'From the desktop app')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('extractJson tolerates code fences and surrounding prose', () => {
  assert.deepEqual(extractJson('Sure:\n```json\n{"a":1}\n```\nDone'), { a: 1 })
  assert.deepEqual(extractJson('The result is [1,2] .'), [1, 2])
  assert.throws(() => extractJson('no structure here'))
})

test('fallback content says plainly that no model is connected', () => {
  const state = seed()
  assert.match(fallbackArticle(state, state.items[0]), /No text model is connected/)
  const plan = fallbackPlan(state.items[0], '## One\n## Two', { imageCount: 2, shotCount: 6 })
  assert.equal(plan.images.length, 2)
  assert.equal(plan.shots.length, 6)
})

test('proposeRules proposes from the data and does not repeat existing rules', () => {
  const state = seed()
  const first = proposeRules(state)
  assert.ok(first.length > 0)
  assert.ok(first.every(p => p.evidence))
  applyOps(state, first.map(p => ({ op: 'add_skill', ...p })))
  assert.equal(proposeRules(state).length, 0)
})

test('proposeRules proposes nothing without data', () => {
  const state = seed()
  state.metrics = []
  assert.equal(proposeRules(state).length, 0)
})

test('computeInsights totals agree with the daily and per-platform data', () => {
  const state = seed()
  const data = computeInsights(state)
  assert.equal(data.daily.reduce((a, b) => a + b.views, 0), data.views)
  assert.equal(data.platforms.reduce((a, b) => a + b.views, 0), data.views)
})

test('requestRejection refuses without an auth service and defers to one when present', () => {
  const req = { headers: { cookie: 'x' } }
  assert.equal(requestRejection({ get: () => undefined }, req), 403)
  assert.equal(requestRejection({ get: () => ({ requestRejection: () => 401 }) }, req), 401)
  let seen = null
  const allowed = requestRejection({ get: () => ({ requestRejection: (r) => { seen = r; return undefined } }) }, req)
  assert.equal(allowed, undefined)
  assert.equal(seen.headers, req.headers)
})

test('exportSkill does not export sample rules or sample people', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'media-desk-skill-'))
  try {
    const state = seed()
    await assert.rejects(exportSkill(state, dir), /Sample rules and presets are never exported/)
    applyOps(state, [{ op: 'add_skill', name: 'My rule', rule: 'Titles stay under 20 characters', status: 'active' }])
    const result = await exportSkill(state, dir)
    assert.equal(result.rules, 1)
    const body = await readFile(result.path, 'utf8')
    assert.match(body, /^---\nname: media-desk-voice\n/)
    assert.match(body, /My rule/)
    assert.doesNotMatch(body, /Lead with a number/)
    assert.doesNotMatch(body, /Lena, curious beginner/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('assertPublicUrl refuses this machine and private-network addresses', async () => {
  for (const url of ['http://localhost:3000', 'http://127.0.0.1', 'http://10.0.0.1', 'http://192.168.1.1', 'http://169.254.169.254/latest', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'file:///etc/passwd']) {
    await assert.rejects(assertPublicUrl(url), url)
  }
})

test('harvest reads metadata and refuses redirects into the private network', async () => {
  const page = '<html><head><title>Backup title</title><meta property="og:title" content="Home &amp; Profile"><meta name="description" content="12k followers"><meta property="og:image" content="/a.jpg"></head></html>'
  const ok = async () => new Response(page, { headers: { 'content-type': 'text/html' } })
  const info = await harvest('https://93.184.216.34/u', ok)
  assert.equal(info.title, 'Home & Profile')
  assert.equal(info.image, 'https://93.184.216.34/a.jpg')
  assert.equal(info.followers, 12000)

  // A profile page served in Chinese still yields its follower count. The
  // fixture is escaped so the test file itself carries no literal CJK.
  const chinese = '<html><head><title>Backup title</title><meta name="description" content="\u7c89\u4e1d 1.2\u4e07"></head></html>'
  const zh = async () => new Response(chinese, { headers: { 'content-type': 'text/html' } })
  assert.equal((await harvest('https://93.184.216.34/u', zh)).followers, 12000)

  const redirect = async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } })
  await assert.rejects(harvest('https://93.184.216.34/u', redirect), /private network|this machine/)
})

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
const IMAGE = { baseUrl: 'https://img.example/v1', model: 'm', apiKey: 'secret-key-1234', size: '1536x1024', quality: '', extra: '{"output_format":"jpeg"}' }

test('generateImage sends the standard request and accepts both b64 and images[0].url responses', async () => {
  const calls = []
  const b64 = async (url, init) => {
    calls.push([String(url), init])
    return new Response(JSON.stringify({ data: [{ b64_json: PNG.toString('base64') }] }), { status: 200 })
  }
  const one = await generateImage(IMAGE, 'p', { fetchImpl: b64 })
  assert.equal(one.ext, '.png')
  assert.equal(calls[0][0], 'https://img.example/v1/images/generations')
  assert.equal(calls[0][1].headers.authorization, 'Bearer secret-key-1234')
  assert.deepEqual(JSON.parse(calls[0][1].body), { model: 'm', prompt: 'p', n: 1, size: '1536x1024', output_format: 'jpeg' })

  const viaUrl = async (url) => (String(url).endsWith('/generations')
    ? new Response(JSON.stringify({ images: [{ url: 'https://93.184.216.34/a.png' }] }))
    : new Response(PNG))
  assert.equal((await generateImage(IMAGE, 'p', { fetchImpl: viaUrl })).ext, '.png')
})

test('generateImage refuses private download addresses and non-images, and never leaks the key', async () => {
  const internal = async () => new Response(JSON.stringify({ data: [{ url: 'http://127.0.0.1/x.png' }] }))
  await assert.rejects(generateImage(IMAGE, 'p', { fetchImpl: internal }), /private network|this machine/)
  const html = async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('<html>').toString('base64') }] }))
  await assert.rejects(generateImage(IMAGE, 'p', { fetchImpl: html }), /isn't an image/)
  const leak = async () => new Response(JSON.stringify({ error: { message: 'bad key secret-key-1234' } }), { status: 400 })
  await assert.rejects(generateImage(IMAGE, 'p', { fetchImpl: leak }), err => !err.message.includes('secret-key') && err.message.includes('***'))
  const denied = async () => new Response('{}', { status: 401 })
  await assert.rejects(generateImage(IMAGE, 'p', { fetchImpl: denied }), /key is invalid/)
})

test('generateImage retries once on a 5xx', async () => {
  let n = 0
  const flaky = async () => {
    n += 1
    return n === 1 ? new Response('<html>', { status: 502 }) : new Response(JSON.stringify({ data: [{ b64_json: PNG.toString('base64') }] }))
  }
  assert.equal((await generateImage(IMAGE, 'p', { fetchImpl: flaky })).ext, '.png')
  assert.equal(n, 2)
})

test('Settings are mode 600, the key never leaks, and an empty key does not overwrite it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'media-desk-set-'))
  try {
    const settings = new Settings(dir)
    await settings.update({ image: { baseUrl: 'https://x.example/v1/images/generations/', model: 'm', apiKey: 'sk-abcdefgh1234' }, imageCount: 99 })
    assert.equal((await stat(join(dir, 'settings.json'))).mode & 0o777, 0o600)
    const open = publicSettings(await settings.read())
    assert.equal(open.image.baseUrl, 'https://x.example/v1')
    assert.equal(open.image.keyHint, '1234')
    assert.equal(open.imageCount, 4)
    assert.equal(open.imageReady, true)
    assert.ok(!JSON.stringify(open).includes('abcdefgh'))
    await settings.update({ image: { apiKey: '  ', model: 'n' } })
    assert.equal((await settings.read()).image.apiKey, 'sk-abcdefgh1234')
    await assert.rejects(settings.update({ image: { baseUrl: 'javascript:alert(1)' } }), /http/)
    await assert.rejects(settings.update({ image: { extra: '[1]' } }), /JSON/)
    await settings.update({ image: { clearKey: true } })
    assert.equal(publicSettings(await settings.read()).imageReady, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('normalizePlan drops extra fields and truncates to the settings', () => {
  const plan = normalizePlan({ title: 'T', cover: 'c', images: [{ prompt: 'a', evil: 1 }, { prompt: 'b' }, { prompt: 'c' }], shots: [{ prompt: 'x', seconds: 999 }, 'bad', null] }, { imageCount: 2, shotCount: 6 }, 'fallback')
  assert.equal(plan.images.length, 2)
  assert.equal(plan.images[0].evil, undefined)
  assert.equal(plan.shots.length, 1)
  assert.equal(plan.shots[0].seconds, 60)
  assert.equal(plan.shots[0].shot, 'Medium shot')
  assert.equal(normalizePlan(null, { imageCount: 1, shotCount: 1 }, 'F').title, 'F')
  // Cover-text fallback cuts on word boundaries inside the 24-character cap
  const long = normalizePlan({}, { imageCount: 0, shotCount: 0 }, 'A very long title that keeps going and going')
  assert.equal(long.coverText, 'A very long title that')
  assert.ok(long.coverText.length <= 24)
})

async function producerFixture({ callText, generate, ready = true }) {
  const dir = await mkdtemp(join(tmpdir(), 'media-desk-prod-'))
  const store = new Store(dir)
  await store.read()
  const settings = new Settings(dir)
  await settings.update({ imageCount: 1, shotCount: 2, voice: 'Short sentences, fond of metaphors', ...(ready ? { image: { baseUrl: 'https://i.example/v1', model: 'm', apiKey: 'k' } } : {}) })
  return { dir, store, producer: new Producer({ store, settings, callText, generate }) }
}

async function waitDone(producer, id) {
  for (let i = 0; i < 200 && producer.isRunning(id); i += 1) await new Promise(r => setTimeout(r, 20))
}

const isPlan = system => system.includes('content editor')
const PLAN = JSON.stringify({ title: 'The final title', cover: 'cover', characters: 'a man', images: [{ anchor: 'The first section', caption: 'Caption', prompt: 'fig' }], shots: [{ shot: 'Close-up', visual: 'Hands', voice: 'Say', seconds: 4, prompt: 's1' }, { shot: 'Wide', visual: 'Street', voice: 'Say', seconds: 6, prompt: 's2' }] })

test('Producer runs the whole pipeline: article, plan and every image, with the voice in the prompt', async () => {
  const prompts = []
  const systems = []
  const callText = async ({ system, onText }) => {
    systems.push(system)
    if (isPlan(system)) return { text: PLAN, model: 'deepseek' }
    onText('# Model title\n\nBody')
    return { text: '# Model title\n\n## The first section\nBody', model: 'deepseek' }
  }
  const generate = async (_, prompt) => {
    prompts.push(prompt)
    return { buffer: PNG, ext: '.png' }
  }
  const { dir, store, producer } = await producerFixture({ callText, generate })
  try {
    assert.equal(await producer.start('seed_2'), true)
    assert.equal(await producer.start('seed_2'), false)
    await waitDone(producer, 'seed_2')
    const item = (await store.read()).items.find(i => i.id === 'seed_2')
    const p = item.production
    assert.equal(p.status, 'done')
    assert.equal(p.title, 'The final title')
    assert.match(p.article, /## The first section/)
    assert.doesNotMatch(p.article, /Model title/)
    assert.equal(p.cover.status, 'done')
    assert.match(p.cover.src, /^media-desk\/files\/g_.+\.png$/)
    assert.equal(p.shots.length, 2)
    assert.ok(p.shots.every(s => s.status === 'done'))
    assert.equal(item.status, 'draft')
    assert.equal(prompts.length, 4)
    assert.ok(prompts.some(x => x.includes('black and white') && x.includes('a man')))
    assert.ok(systems.every(x => x.includes('Short sentences, fond of metaphors')))
    assert.ok(isPlan(systems[0]))
    assert.equal((await stat(join(dir, 'files', p.cover.src.split('/').pop()))).size, PNG.length)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('Producer backfills storyboard shots the model left out', async () => {
  const callText = async ({ system }) => (isPlan(system) ? { text: '{"title":"T","cover":"c","images":[],"shots":[{"shot":"Close-up","visual":"Hands","prompt":"x"}]}', model: 'd' } : { text: '# T\n## One\nBody', model: 'd' })
  const { dir, store, producer } = await producerFixture({ callText, generate: async () => ({ buffer: PNG, ext: '.png' }) })
  try {
    await producer.start('seed_2')
    await waitDone(producer, 'seed_2')
    const p = (await store.read()).items.find(i => i.id === 'seed_2').production
    assert.equal(p.images.length, 1)
    assert.equal(p.shots.length, 2)
    assert.deepEqual(p.shots.map(s => s.no), [1, 2])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('Producer starts the article and the images together, and the streaming plan shows its title and shots', async () => {
  const order = []
  let release
  const gate = new Promise((r) => { release = r })
  const callText = async ({ system, onText }) => {
    if (isPlan(system)) {
      onText('{"title":"Streaming title","shots":[{"visual":"First shot"},{"visual":"Second shot"}]')
      return { text: PLAN, model: 'd' }
    }
    order.push('article-start')
    await gate
    order.push('article-end')
    return { text: 'Body', model: 'd' }
  }
  const generate = async () => {
    order.push('image')
    return { buffer: PNG, ext: '.png' }
  }
  const { dir, store, producer } = await producerFixture({ callText, generate })
  try {
    await producer.start('seed_2')
    for (let i = 0; i < 100 && !order.includes('image'); i += 1) await new Promise(r => setTimeout(r, 20))
    // The article is still being written and the images have already started
    assert.ok(order.includes('image'))
    assert.ok(!order.includes('article-end'))
    const live = producer.status('seed_2')
    assert.equal(live.title, 'Streaming title')
    assert.deepEqual(live.visuals, ['First shot', 'Second shot'])
    release()
    await waitDone(producer, 'seed_2')
    const p = (await store.read()).items.find(i => i.id === 'seed_2').production
    assert.equal(p.status, 'done')
    assert.equal(p.article, 'Body')
    assert.equal(p.title, 'The final title')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('One failed image does not block the others, and can be redrawn on its own', async () => {
  let fail = true
  const generate = async (_, prompt) => {
    if (prompt.includes('s1') && fail) throw new Error('Out of quota')
    return { buffer: PNG, ext: '.png' }
  }
  const callText = async ({ system }) => (isPlan(system) ? { text: PLAN, model: 'd' } : { text: '# T\nBody', model: 'd' })
  const { dir, store, producer } = await producerFixture({ callText, generate })
  try {
    await producer.start('seed_2')
    await waitDone(producer, 'seed_2')
    let p = (await store.read()).items.find(i => i.id === 'seed_2').production
    assert.equal(p.status, 'done')
    assert.equal(p.shots[0].status, 'failed')
    assert.equal(p.shots[0].error, 'Out of quota')
    assert.equal(p.shots[1].status, 'done')
    fail = false
    await producer.regenerate('seed_2', 'shot:0')
    await new Promise(r => setTimeout(r, 40))
    p = (await store.read()).items.find(i => i.id === 'seed_2').production
    assert.equal(p.shots[0].status, 'done')
    await assert.rejects(producer.regenerate('seed_2', '../x'), /Invalid target/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('Without an image model Producer writes text and storyboard copy only, and without a model it gives a structural draft', async () => {
  const callText = async () => { throw new Error('no model') }
  const generate = async () => { throw new Error('should not be called') }
  const { dir, store, producer } = await producerFixture({ callText, generate, ready: false })
  try {
    await producer.start('seed_2')
    await waitDone(producer, 'seed_2')
    const p = (await store.read()).items.find(i => i.id === 'seed_2').production
    assert.equal(p.status, 'done')
    assert.equal(p.engine, 'local')
    assert.match(p.article, /structural draft/)
    assert.equal(p.needsProvider, true)
    assert.equal(p.cover.status, 'skipped')
    assert.equal(p.shots.length, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('Producer can be cancelled, and a job left running by a restart is marked interrupted', async () => {
  const callText = ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
  const { dir, store, producer } = await producerFixture({ callText, generate: async () => ({ buffer: PNG, ext: '.png' }) })
  try {
    await producer.start('seed_2')
    await producer.cancel('seed_2')
    await waitDone(producer, 'seed_2')
    assert.equal((await store.read()).items.find(i => i.id === 'seed_2').production.status, 'cancelled')

    await store.mutate('x', (s) => { s.items.find(i => i.id === 'seed_3').production = { status: 'running', cover: { status: 'running' }, images: [], shots: [] }; return s }, { undoable: false })
    await producer.settle('seed_3')
    const p = (await store.read()).items.find(i => i.id === 'seed_3').production
    assert.equal(p.status, 'failed')
    assert.equal(p.cover.status, 'idle')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

function revisable() {
  return {
    status: 'done', title: 'Old title', article: 'Opening paragraph.\n\n## The first section\n\nThis needs changing.',
    cover: { prompt: 'c', status: 'done' }, images: [{ caption: 'Figure', prompt: 'i', status: 'done', anchor: 'The first section' }],
    shots: [{ no: 1, shot: 'Medium shot', visual: 'v', voice: 'x', seconds: 5, prompt: 'p', status: 'done' }],
  }
}

test('applyRevision changes the title, replaces locally, and only redraws images whose picture changed', () => {
  const p = revisable()
  const { receipts, errors, targets } = applyRevision(p, {
    title: 'New title', edits: [{ find: 'This needs changing', replace: '$& fixed' }, { find: 'a sentence that is not there', replace: 'x' }],
    cover: { prompt: 'night' }, images: [{ no: 1, caption: 'New caption' }], shots: [{ no: 1, voice: 'New voice-over', prompt: 'top' }, { no: 9, prompt: 'out of range' }],
  })
  assert.equal(p.title, 'New title')
  // $& inside replace must not be treated as replacement syntax
  assert.match(p.article, /\$& fixed/)
  assert.equal(p.images[0].caption, 'New caption')
  assert.equal(p.images[0].prompt, 'i')
  assert.equal(p.shots[0].voice, 'New voice-over')
  assert.deepEqual(targets, ['cover', 'shot:0'])
  assert.equal(errors.length, 1)
  assert.ok(receipts.length >= 4)
  assert.ok(receipts.includes('Changed the title to "New title"'))
  assert.ok(receipts.includes('Made 1 edit to the script'))
  assert.ok(receipts.includes('Redrew the cover'))
  assert.ok(receipts.includes('Changed the caption of image 1'))
  assert.ok(receipts.includes('Redrew shot 1'))

  // Without an image model the receipt says the description was updated instead
  const offline = applyRevision({ ...revisable(), images: [] }, { shots: [{ no: 1, prompt: 'r' }] }, { canDraw: false })
  assert.match(offline.receipts[0], /^Updated the image description for shot 1 \(it will be redrawn once an image model is connected\)$/)
})

test('applyRevision ignores garbage input and strips the top-level heading on a full rewrite', () => {
  const p = revisable()
  const before = JSON.stringify(p)
  assert.deepEqual(applyRevision(p, null), { receipts: [], errors: [], targets: [] })
  applyRevision(p, { images: 'x', shots: [null, 3], edits: [1, { find: 2 }], title: 5 })
  assert.equal(JSON.stringify(p), before)
  applyRevision(p, { article: '# Heading\n\nNew body' })
  assert.equal(p.article, 'New body')
})

test('chatPrompts only hands a finished draft to the model', () => {
  const state = seed()
  const item = state.items[0]
  assert.doesNotMatch(chatPrompts(state, 'x', { focusId: item.id }).user, /<production>/)
  item.production = { ...revisable(), article: 'Unique body' }
  const prompts = chatPrompts(state, 'x', { focusId: item.id })
  assert.match(prompts.user, /<production>.*Unique body/)
  assert.match(prompts.system, /revise/)
  item.production.status = 'running'
  assert.doesNotMatch(chatPrompts(state, 'x', { focusId: item.id }).user, /<production>/)
})

test('saveProduction writes the article, script and assets, with path characters stripped from the title', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'media-desk-save-'))
  try {
    const filesDir = join(dir, 'files')
    await mkdir(filesDir)
    await writeFile(join(filesDir, 'a.jpg'), PNG)
    await writeFile(join(filesDir, 'b.jpg'), PNG)
    const p = revisable()
    p.title = '../Danger/Title: Test'
    p.cover.src = 'media-desk/files/a.jpg'
    p.images[0].src = 'media-desk/files/b.jpg'
    p.shots[0].src = 'media-desk/assets/../../secret.jpg'
    p.shots[0].voice = 'line one | line two'
    const saved = await saveProduction(p, { filesDir, exportDir: join(dir, 'out'), videoCover: Buffer.from([0xff, 0xd8, 0xff]) })
    assert.equal(saved.path, join(dir, 'out', 'Danger Title Test'))
    const names = await readdir(saved.path)
    assert.deepEqual(names.sort(), ['cover-original.jpg', 'figure-1.jpg', 'script.md', 'storyboard.md', 'video-cover.jpg'].sort())
    const article = await readFile(join(saved.path, 'script.md'), 'utf8')
    assert.match(article, /^# \.\.\/Danger/)
    assert.match(article, /This needs changing\.\n\n!\[Figure\]\(figure-1\.jpg\)/)
    const board = await readFile(join(saved.path, 'storyboard.md'), 'utf8')
    assert.ok(board.includes('line one \\| line two'))
    // Saving again writes back to the same folder
    p.savedPath = saved.path
    assert.equal((await saveProduction({ ...p, title: 'Renamed' }, { filesDir, exportDir: join(dir, 'out') })).path, saved.path)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('resolveExportDir expands ~ and falls back to the default location for an empty value', () => {
  assert.match(resolveExportDir(''), /Documents\/Media Desk$/)
  assert.ok(!resolveExportDir('~/x').startsWith('~'))
  assert.equal(resolveExportDir('/tmp/x'), '/tmp/x')
})

test('Style: only whitelisted fields survive, the card becomes writing instructions, and it reaches the prompts', () => {
  const style = normalizeStyle({ name: 'Half a beat behind', summary: 's', tone: 't', words: ['that day', 3, ''], samples: ['sample line'], evil: 1 })
  assert.equal(style.evil, undefined)
  assert.deepEqual(style.words, ['that day'])
  assert.match(styleToVoice(style), /Go-to words: that day/)
  assert.equal(normalizeStyle(null, 'Backup').name, 'Backup')
  assert.equal(styleToVoice(null), '')
  assert.match(stylePrompts('Material', '').system, /style analyst/)

  const state = seed()
  const item = state.items[0]
  const { receipts } = applyOps(state, [{ op: 'add_style', name: 'Mine', tone: 'A very distinctive tone' }])
  assert.equal(activeStyle(state), null)
  // With no style selected, the voice from settings is used
  assert.match(articlePrompts(state, item, 'Old voice').system, /Old voice/)
  applyOps(state, [{ op: 'set_style', id: receipts[0].target }])
  const prompts = articlePrompts(state, item, 'Old voice')
  assert.match(prompts.system, /A very distinctive tone/)
  assert.doesNotMatch(prompts.system, /Old voice/)
  assert.match(planPrompts(state, item, { imageCount: 1, shotCount: 1 }).system, /A very distinctive tone/)
  applyOps(state, [{ op: 'delete_style', id: receipts[0].target }])
  assert.equal(state.activeStyleId, null)
})

test('The script prompt carries the planned facts and voice-over so the numbers agree', () => {
  const state = seed()
  const plan = { title: 'T', outline: ['One'], facts: ['saved 214 prompts'], shots: [{ visual: 'v', voice: 'saved 214 in three months' }] }
  const { system, user } = articlePrompts(state, state.items[0], '', plan)
  assert.match(system, /voiceover script/)
  assert.match(system, /saved 214 prompts/)
  assert.match(user, /saved 214 in three months/)
  // The prompts are English-only now; there is no language directive to append
  assert.doesNotMatch(system, CJK)
  assert.doesNotMatch(planPrompts(state, state.items[0], { imageCount: 1, shotCount: 1 }).system, CJK)
  const normalized = normalizePlan({ title: 'T', coverText: 'Cover words', facts: ['a', 1] }, { imageCount: 0, shotCount: 0 }, 'x')
  assert.equal(normalized.coverText, 'Cover words')
  assert.deepEqual(normalized.facts, ['a'])
})

test('Style presets: old templates become the new presets, and clearing samples keeps the presets', async () => {
  const { STYLE_CATEGORIES, STYLE_PRESETS } = await import('../src/style-presets.js')
  for (const row of STYLE_PRESETS) {
    assert.ok(STYLE_CATEGORIES.includes(row.category), row.name)
    for (const key of ['icon', 'name', 'summary', 'tone', 'sentences', 'opening', 'structure']) assert.ok(row[key], `${row.name} is missing ${key}`)
    assert.ok(row.words.length && row.avoid.length && row.samples.length, row.name)
    assert.ok(!/[\u4e00-\u9fff]/.test(row.icon), `${row.name} icon must not be a CJK character`)
  }
  assert.equal(new Set(STYLE_PRESETS.map(row => row.icon)).size, STYLE_PRESETS.length)
  for (const category of STYLE_CATEGORIES) assert.ok(STYLE_PRESETS.some(row => row.category === category), category)

  const old = { items: [], activeStyleId: 'seed_style_story', styles: [{ id: 'seed_style_story', name: 'Relaxed storytelling', sample: true }, { id: 'st_1', name: 'Mine' }] }
  migrateState(old)
  assert.equal(old.activeStyleId, 'preset_story')
  assert.equal(old.styles.some(row => row.id.startsWith('seed_style_')), false)
  assert.equal(old.styles[0].name, 'Mine')
  assert.equal(old.styles.filter(row => row.preset).length, STYLE_PRESETS.length)

  // A preset that was deleted is not added back
  const deleted = migrateState({ items: [], sampleCleared: true })
  assert.equal(deleted.styles.length, STYLE_PRESETS.length)
  applyOps(deleted, [{ op: 'delete_style', id: 'preset_news' }])
  assert.equal(migrateState(deleted).styles.some(row => row.id === 'preset_news'), false)

  const state = seed()
  assert.equal(state.styles.length, STYLE_PRESETS.length)
  assert.ok(state.items.some(row => row.sample))
  // The fresh seed is English-only and no longer carries a sample language
  assert.equal(state.sampleLang, undefined)
  assert.ok(!CJK.test(JSON.stringify(state)))
  applyOps(state, [{ op: 'add_style', name: 'Mine' }, { op: 'set_style', id: 'preset_travel' }, { op: 'clear_samples' }])
  assert.equal(state.items.some(row => row.sample), false)
  assert.equal(state.metrics.some(row => row.sample), false)
  assert.equal(state.skills.some(row => row.sample), false)
  assert.equal(state.accounts.some(row => row.sample), false)
  assert.equal(state.styles.length, STYLE_PRESETS.length + 1)
  assert.equal(state.activeStyleId, 'preset_travel')
})

test('migrateState upgrades upstream Chinese data, keeps edits, and rekeys imported identities', () => {
  const legacy = {
    sampleLang: 'zh', presetVersion: 1,
    items: [
      { id: 'seed_1', sample: true, title: 'My English title', body: '\u65e7\u6b63\u6587', tags: ['\u65e7\u6807\u7b7e'], source: '\u8def\u4e0a\u60f3\u5230', platform: '\u5c0f\u7ea2\u4e66', media: { src: 'media-desk/assets/poster.jpg', w: 720, h: 960 }, drafts: {}, production: { title: '\u4e2d\u6587\u6210\u7a3f' } },
      { id: 'it_imported', sample: false, title: 'My imported post', platform: '\u5c0f\u7ea2\u4e66', externalId: '\u5c0f\u7ea2\u4e66:post1', drafts: {} },
    ],
    people: [
      { id: 'newbie', sample: true, name: '\u60f3\u5165\u95e8\u7684\u5c0f\u6797', role: '\u76ee\u6807\u8bfb\u8005', note: '\u4e8c\u5341\u4e94\u5c81', traits: ['\u6015\u672f\u8bed'], tone: 0 },
      { id: 'mine', name: '\u6211\u81ea\u5df1\u7684\u4eba\u8bbe', role: 'Custom', note: 'keep me', traits: [], tone: 1 },
    ],
    angles: [{ id: 'case', sample: true, name: '\u771f\u5b9e\u6848\u4f8b', hook: '\u4e00\u4e2a\u4eba\u505a\u4e86\u4ec0\u4e48', prompt: '\u4ece\u4e00\u4e2a\u5177\u4f53\u7684\u4eba\u5207\u5165\u3002' }],
    skills: [{ id: 'seed_s_1', sample: true, name: '\u5f00\u5934\u5148\u7ed9\u6570\u5b57', rule: '\u5f00\u5934\u51fa\u73b0\u6570\u5b57\u3002', evidence: '\u793a\u4f8b\uff1a\u6765\u81ea 3 \u7bc7', source: '\u793a\u4f8b', status: 'active', confidence: 0.82 }],
    accounts: [{ id: 'ac_imported', platform: '\u5c0f\u7ea2\u4e66', handle: 'me', externalId: '\u5c0f\u7ea2\u4e66:u1' }],
    metrics: [{ id: 'm_1', itemId: 'it_imported', platform: '\u5c0f\u7ea2\u4e66', externalId: '\u5c0f\u7ea2\u4e66:post1', views: 10 }],
    styles: [
      { id: 'preset_news', preset: true, category: '\u70ed\u70b9\u8d44\u8baf', name: '\u70ed\u70b9\u8d44\u8baf', summary: 'My summary', tone: 't', sentences: 's', opening: 'o', structure: 'st', words: [], avoid: [], samples: [] },
      { id: 'st_mine', category: '\u70ed\u70b9\u8d44\u8baf', name: '\u6211\u7684\u98ce\u683c', accountKey: '\u5c0f\u7ea2\u4e66:u1' },
    ],
  }
  const once = migrateState(legacy)
  const seedRow = buildSeed(NOW).items[0]
  // Field by field: the English title survives while the Chinese body is translated.
  assert.equal(once.items[0].title, 'My English title')
  assert.equal(once.items[0].body, seedRow.body)
  assert.deepEqual(once.items[0].tags, seedRow.tags)
  assert.equal(once.items[0].source, seedRow.source)
  assert.equal(once.items[0].platform, 'RedNote')
  assert.match(once.items[0].media.src, /poster-en\.jpg$/)
  // Chinese model output on a sample card is placeholder work, so it goes.
  assert.equal(once.items[0].production, undefined)
  // Built-in people, angles and rules are translated; user rows are left alone.
  assert.equal(once.people[0].name, 'Lena, curious beginner')
  assert.equal(once.people[0].role, 'Target reader')
  assert.equal(once.angles[0].name, 'Real case')
  assert.equal(once.skills[0].name, 'Lead with a number')
  assert.equal(once.skills[0].source, 'Sample')
  assert.equal(once.people[1].name, '\u6211\u81ea\u5df1\u7684\u4eba\u8bbe')
  assert.equal(once.styles.find(row => row.id === 'st_mine').name, '\u6211\u7684\u98ce\u683c')
  // Presets translate per field, so an edited summary survives.
  const news = once.styles.find(row => row.id === 'preset_news')
  assert.equal(news.summary, 'My summary')
  assert.equal(news.name, 'News commentary creator')
  assert.equal(news.category, 'News')
  // Compound keys follow the platform rename, so re-importing updates instead of duplicating.
  assert.equal(once.items[1].externalId, 'RedNote:post1')
  assert.equal(once.accounts[0].externalId, 'RedNote:u1')
  assert.equal(once.metrics[0].externalId, 'RedNote:post1')
  assert.equal(once.styles.find(row => row.id === 'st_mine').accountKey, 'RedNote:u1')
  const imported = importPosts(once, {
    account: { platform: 'RedNote', id: 'u1', url: 'https://example.com/u1' },
    profile: { nickname: 'me', followers: 10, description: 'd' },
    posts: [{ id: 'post1', title: 'My imported post', body: 'text', publishedAt: '2026-10-01T00:00:00Z', url: 'https://example.com/p1', views: 250, likes: 1, comments: 1, shares: 1, saves: 1 }],
  })
  assert.deepEqual(imported, { added: 0, updated: 1 })
  assert.equal(once.items.filter(row => row.externalId === 'RedNote:post1').length, 1)
  assert.equal(once.accounts.filter(row => row.externalId === 'RedNote:u1').length, 1)
  assert.equal(once.metrics.filter(row => row.externalId === 'RedNote:post1').length, 1)
  assert.equal(once.sampleLang, undefined)

  const snapshot = JSON.stringify(once)
  migrateState(once)
  assert.equal(JSON.stringify(once), snapshot)
})

test('harvestText extracts the body and drops scripts and navigation', async () => {
  const page = '<html><head><title>Backup title</title><style>x{}</style></head><body><nav>Navigation text that should not appear</nav><script>var a=1</script><p>This is the first paragraph of body text, long enough.</p><div>This is the second &amp; body paragraph, long enough.</div></body></html>'
  const { text, title } = await harvestText('https://93.184.216.34/a', async () => new Response(page, { headers: { 'content-type': 'text/html' } }))
  assert.equal(title, 'Backup title')
  assert.match(text, /first paragraph/)
  assert.match(text, /second & body/)
  assert.doesNotMatch(text, /Navigation|var a/)
  await assert.rejects(harvestText('http://127.0.0.1/x'), /private network|this machine/)
})

test('applyRevision can change the cover text', () => {
  const p = revisable()
  const { receipts } = applyRevision(p, { coverText: 'New cover text' })
  assert.equal(p.coverText, 'New cover text')
  assert.match(receipts[0], /New cover text/)
  assert.equal(receipts[0], 'Changed the cover text to "New cover text"')
})

test('When learning a style, the name the user typed wins over the model name', async () => {
  const { normalizeStyle } = await import('../src/style.js')
  assert.equal(normalizeStyle({ name: 'Half a beat behind' }, 'My own').name, 'My own')
  assert.equal(normalizeStyle({ name: 'Half a beat behind' }, '').name, 'Half a beat behind')
  assert.equal(normalizeStyle({}, '').name, 'Untitled style')
})

test('Monid: profile links accept the domestic platform URL formats and reject lookalike hosts', async () => {
  const { findUrl, parseAccountUrl } = await import('../src/monid.js')
  assert.equal(parseAccountUrl('https://www.xiaohongshu.com/user/profile/aaaabbbbccccdddd00001111?xsec=1').platform, 'RedNote')
  assert.equal(parseAccountUrl('https://www.douyin.com/user/MS4wLjABAAAAabcdefghijklmnopqrstuvwxyz?from=1').id, 'MS4wLjABAAAAabcdefghijklmnopqrstuvwxyz')
  assert.equal(parseAccountUrl('https://space.bilibili.com/12345678/video').id, '12345678')
  for (const bad of ['https://evil.example/user/profile/aaaabbbbccccdddd00001111', 'https://xiaohongshu.com.evil.example/user/profile/aaaabbbbccccdddd00001111', 'https://www.xiaohongshu.com/user/profile/--query', 'https://www.douyin.com/user/self', 'javascript:alert(1)']) {
    assert.equal(parseAccountUrl(bad), null, bad)
  }
  assert.equal(findUrl('Copy this link https://v.douyin.com/abc/ and open Douyin'), 'https://v.douyin.com/abc/')
})

test('Monid: short links only follow the platform\'s own domains, and a non-profile result is an error', async () => {
  const { resolveAccount } = await import('../src/monid.js')
  await assert.rejects(resolveAccount('https://evil.example/x', async () => assert.fail('should not fetch')), /isn't recognized/)
  await assert.rejects(resolveAccount('no link here'), /No link found/)
  const hops = []
  const fake = async (url) => { hops.push(url); return { headers: new Headers({ location: 'https://space.bilibili.com/42' }) } }
  const account = await resolveAccount('Look at this https://b23.tv/abc', fake)
  assert.equal(account.id, '42')
  assert.equal(hops.length, 1)
})

const xhsOutput = { code: 0, success: true, data: { notes: [
  { id: 'a'.repeat(24), title: 'First post', desc: 'Body text', create_time: 1790000000, likes: 10, comments_count: 2, collected_count: 3, share_count: 1, view_count: 0, images_list: [{ url: 'http://ci.example/1.jpg' }] },
  { id: 'not-valid', title: 'Bad data' },
] } }

test('Monid: only the usable fields come through, and bad rows and platform errors do not', async () => {
  const { normalizePosts, normalizeProfile } = await import('../src/monid.js')
  const [note, ...rest] = normalizePosts('RedNote', xhsOutput)
  assert.equal(rest.length, 0)
  assert.deepEqual([note.title, note.likes, note.views, note.cover], ['First post', 10, 0, 'https://ci.example/1.jpg'])
  assert.equal(note.url, `https://www.xiaohongshu.com/explore/${'a'.repeat(24)}`)
  const [video] = normalizePosts('Douyin', { status_code: 0, aweme_list: [{ aweme_id: '123', desc: 'First line\nSecond line', create_time: 1790000000, statistics: { digg_count: 5, play_count: 0 }, video: { cover: { url_list: ['https://p.example/c.jpg'] } } }] })
  assert.deepEqual([video.title, video.likes, video.url], ['First line', 5, 'https://www.douyin.com/video/123'])
  const [bili] = normalizePosts('Bilibili', { code: 0, data: { list: { vlist: [{ bvid: 'BV1xx', title: 'Video', created: 1790000000, play: 99, comment: 1, pic: '//i0.example/a.jpg' }] } } })
  assert.deepEqual([bili.views, bili.cover], [99, 'https://i0.example/a.jpg'])
  assert.throws(() => normalizePosts('Douyin', { status_code: 8, status_msg: 'Account not found' }), /Account not found/)
  assert.throws(() => normalizePosts('Bilibili', { code: -404, message: 'Nothing here' }), /Nothing here/)
  assert.equal(normalizeProfile('Bilibili', { profile: { data: { name: 'Someone' } }, relation: { follower: 7 } }).followers, 7)
  assert.equal(normalizeProfile('RedNote', { profile: { data: { nickname: 'Someone', interactions: [{ type: 'fans', count: 8 }] } } }).followers, 8)
})

test('Monid: cost adds up, a failed profile does not block the content, and the budget limit and missing install are explained', async () => {
  const { fetchAccount, monidStatus } = await import('../src/monid.js')
  const account = { platform: 'RedNote', id: 'a'.repeat(24), url: 'u' }
  const calls = []
  const run = async (args) => {
    calls.push(args)
    if (args.includes('/api/v1/xiaohongshu/app_v2/get_user_info')) throw new Error('timed out')
    return { status: 'COMPLETED', cost: { value: 0.01 }, output: xhsOutput }
  }
  const result = await fetchAccount(account, run)
  assert.equal(result.posts.length, 1)
  assert.equal(result.cost, 0.01)
  assert.equal(calls.length, 2)
  assert.deepEqual(JSON.parse(calls[0][calls[0].indexOf('--query') + 1]), { user_id: 'a'.repeat(24) })
  await assert.rejects(fetchAccount(account, async () => ({ status: 'BLOCKED' })), /budget limit/)
  await assert.rejects(fetchAccount(account, async () => null), /isn't installed/)
  await assert.rejects(fetchAccount(account, async () => ({ status: 'COMPLETED', output: { code: 0, data: { notes: [] } } })), /No posts found/)
  assert.deepEqual(await monidStatus(async () => null), { state: 'missing' })
  assert.deepEqual(await monidStatus(async () => ({ error: { code: 'AUTH_FAILED' } })), { state: 'nokey' })
  assert.deepEqual(await monidStatus(async () => ({ balance: { value: 1.5, currency: 'USD' } })), { state: 'ready', balance: { value: 1.5, currency: 'USD' } })
})

test('Monid: a second import only updates the numbers, sample data drops out of insights, and engagement ranks when there are no views', async () => {
  const { importPosts, normalizePosts, postsToMaterial } = await import('../src/monid.js')
  const { computeInsights } = await import('../src/learn.js')
  const posts = normalizePosts('RedNote', xhsOutput)
  const draft = { items: [{ id: 's', title: 'Sample', status: 'published', sample: true }], metrics: [{ id: 'sm', itemId: 's', platform: 'Douyin', date: '2026-01-01T00:00:00Z', views: 9999, likes: 1, sample: true }], accounts: [{ id: 'sa', followers: 500, sample: true }] }
  const account = { platform: 'RedNote', id: 'x', url: 'https://www.xiaohongshu.com/user/profile/x' }
  const first = importPosts(draft, { account, profile: { nickname: 'Me', followers: 100 }, posts })
  assert.deepEqual(first, { added: 1, updated: 0 })
  const item = draft.items.find(row => row.imported)
  item.title = 'My edited title'
  const second = importPosts(draft, { account, profile: { nickname: 'Me', followers: 120 }, posts: [{ ...posts[0], likes: 50 }] })
  assert.deepEqual(second, { added: 0, updated: 1 })
  assert.equal(draft.items.filter(row => row.imported).length, 1)
  assert.equal(item.title, 'My edited title')
  assert.equal(draft.metrics.filter(row => row.externalId).length, 1)
  assert.equal(draft.accounts.filter(row => row.externalId).length, 1)
  const insights = computeInsights(draft)
  assert.equal(insights.hasSample, false)
  assert.equal(insights.views, 0)
  assert.equal(insights.engaged, 56)
  assert.equal(insights.published, 1)
  assert.equal(insights.followers, 120)
  assert.equal(insights.top[0].engaged, 56)
  assert.match(postsToMaterial(posts), /First post\nBody text/)
})

test('Monid: no shell is involved, noise around the JSON is tolerated, and errors are readable', async () => {
  const { createMonidRunner } = await import('../src/monid.js')
  const located = async () => ({ bin: '/x/monid', path: '/x' })
  let seen
  const noisy = createMonidRunner((bin, args, options, callback) => {
    seen = { bin, args, options }
    callback(null, 'A new version is available\n{"balance":{"value":1}}\n', '')
  }, located)
  const injected = '$(touch /tmp/pwned); --query'
  assert.deepEqual(await noisy(['run', injected]), { balance: { value: 1 } })
  assert.equal(seen.bin, '/x/monid')
  assert.deepEqual(seen.args, ['run', injected])
  assert.equal(seen.options.shell, undefined)
  assert.equal(seen.options.env.NO_COLOR, '1')
  const failing = createMonidRunner((bin, args, options, callback) => callback(new Error('exit 1'), '{"error":{"code":"AUTH_FAILED"}}', ''), located)
  assert.equal((await failing(['balance', '-j'])).error.code, 'AUTH_FAILED')
  const broken = createMonidRunner((bin, args, options, callback) => callback(new Error('exit 1'), '', 'broken'), located)
  await assert.rejects(broken(['balance', '-j']), /broken/)
  assert.equal(await createMonidRunner(() => assert.fail('should not run'), async () => null)(['balance', '-j']), null)
})

test('Monid: covers are saved locally, and private addresses, non-images and existing covers are skipped', async () => {
  const { mkdtemp, readdir, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { saveCovers } = await import('../src/monid.js')
  const dir = await mkdtemp(join(tmpdir(), 'md-covers-'))
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])
  const requested = []
  const fake = async (url) => {
    requested.push(String(url))
    if (String(url).includes('html')) return new Response('<html>', { status: 200 })
    return new Response(png, { status: 200 })
  }
  const posts = [
    { id: 'ok', cover: 'https://93.184.216.34/a.png' },
    { id: 'html', cover: 'https://93.184.216.34/html' },
    { id: 'private', cover: 'https://127.0.0.1/secret.png' },
    { id: 'none', cover: null },
    { id: 'known', cover: 'https://93.184.216.34/known.png' },
  ]
  const state = { items: [{ externalId: 'Douyin:known', media: { src: 'media-desk/files/x.png' } }] }
  const saved = await saveCovers(posts, 'Douyin', state, dir, fake)
  assert.deepEqual([...saved.keys()], ['ok'])
  assert.match(saved.get('ok'), /^media-desk\/files\/c_[\w]+\.png$/)
  assert.equal(requested.some(url => url.includes('127.0.0.1') || url.includes('known')), false)
  assert.equal((await readdir(dir)).length, 1)
  await rm(dir, { recursive: true })
})

test('Scheduling: a calendar slot means ready, unscheduling returns to draft, and published items stay put', () => {
  const state = seed()
  const [ideaR, doneR] = applyOps(state, [{ op: 'add_item', title: 'Only an idea' }, { op: 'add_item', title: 'Already drafted' }]).receipts
  const done = state.items.find(row => row.id === doneR.target)
  done.production = { status: 'done', title: 'Already drafted' }
  applyOps(state, [{ op: 'schedule_item', id: ideaR.target, scheduledAt: '2026-12-01T12:00:00Z' }, { op: 'schedule_item', id: doneR.target, scheduledAt: '2026-12-01T12:00:00Z' }])
  assert.equal(state.items.find(row => row.id === ideaR.target).status, 'outline')
  assert.equal(done.status, 'ready')
  applyOps(state, [{ op: 'schedule_item', id: doneR.target, scheduledAt: null }])
  assert.equal(done.status, 'draft')
  applyOps(state, [{ op: 'update_item', id: doneR.target, status: 'published' }, { op: 'schedule_item', id: doneR.target, scheduledAt: null }])
  assert.equal(done.status, 'published')
  const [media] = applyOps(state, [{ op: 'add_item', kind: 'image', media: { src: 'media-desk/files/x.png' } }]).receipts
  assert.match(state.items.find(row => row.id === media.target).title, /^Image from [A-Z][a-z]{2} \d{1,2}$/)
})

test('Image generation retries after a 429, up to three attempts', async () => {
  const calls = { s1: 0, other: 0 }
  const generate = async (_, prompt) => {
    if (prompt.includes('s1')) {
      calls.s1 += 1
      if (calls.s1 < 3) throw new Error('Too many requests or out of quota (429)')
    } else calls.other += 1
    return { buffer: PNG, ext: '.png' }
  }
  const callText = async ({ system }) => (isPlan(system) ? { text: PLAN, model: 'd' } : { text: '# T\nBody', model: 'd' })
  const { dir, store, producer } = await producerFixture({ callText, generate })
  producer.retryScale = 0.001
  try {
    await producer.start('seed_2')
    await waitDone(producer, 'seed_2')
    const p = (await store.read()).items.find(i => i.id === 'seed_2').production
    assert.equal(calls.s1, 3)
    assert.equal(p.shots[0].status, 'done')
    assert.ok(p.shots.every(row => row.status === 'done'))
  } finally {
    await rm(dir, { recursive: true })
  }
})

test('Undo reverts only its own step: drafts and images made later are untouched', async () => {
  const { Store, revertChange } = await import('../src/store.js')
  const dir = await mkdtemp(join(tmpdir(), 'md-undo-'))
  try {
    const store = new Store(dir)
    const state = await store.read()
    const id = state.items[0].id
    // 1. Switch style (undoable)
    await store.mutate('Switch style', (draft) => { draft.activeStyleId = 'preset_travel' })
    // 2. A draft is produced afterwards (a background write that is not undoable)
    await store.mutate('Draft', (draft) => { draft.items[0].production = { status: 'done', title: 'Original title', shots: [{ no: 1, prompt: 'a', status: 'done', src: 'old.png' }] } }, { undoable: false })
    // 3. The chat changes the title and the first shot's picture (undoable)
    await store.mutate('Chat', (draft) => { const p = draft.items[0].production; p.title = 'New title'; p.shots[0].prompt = 'b'; p.shots[0].status = 'running' })
    // 4. The first shot finishes redrawing (not undoable)
    await store.mutate('Draft', (draft) => { const shot = draft.items[0].production.shots[0]; shot.status = 'done'; shot.src = 'new.png' }, { undoable: false })

    assert.equal(await store.undoLast(), 'Chat')
    let p = (await store.read()).items.find(row => row.id === id).production
    assert.equal(p.title, 'Original title')
    assert.equal(p.shots[0].prompt, 'a')
    assert.equal(p.shots[0].src, 'new.png')
    assert.equal(p.shots[0].status, 'done')

    assert.equal(await store.undoLast(), 'Switch style')
    const after = await store.read()
    assert.equal(after.activeStyleId, null)
    p = after.items.find(row => row.id === id).production
    assert.equal(p.status, 'done', 'undoing the style switch must not erase the draft')

    // A step that changed nothing takes no undo slot
    await store.mutate('Empty step', () => {})
    assert.equal(store.undo.length, 0)

    // Adds and deletes can be undone too, and a deleted row returns to its place
    const removed = after.items[1]
    await store.mutate('Delete', (draft) => { draft.items.splice(1, 1) })
    await store.mutate('Add', (draft) => { draft.items.unshift({ id: 'new_1', title: 'New idea' }) })
    await store.undoLast()
    await store.undoLast()
    const back = await store.read()
    assert.equal(back.items.some(row => row.id === 'new_1'), false)
    assert.equal(back.items[1].id, removed.id)

    assert.deepEqual(revertChange({ a: 1 }, { a: 2 }, { a: 3 }), { a: 3 }, 'keep the current value when it changed again since')
  } finally {
    await rm(dir, { recursive: true })
  }
})

test('Status rules: publish time, schedule and unschedule, and clearing samples leaves no dangling data', () => {
  const state = seed()
  const [r] = applyOps(state, [{ op: 'add_item', title: 'Only an idea' }]).receipts
  const item = state.items.find(row => row.id === r.target)
  applyOps(state, [{ op: 'schedule_item', id: item.id, scheduledAt: '2026-12-01T12:00:00Z' }])
  assert.equal(item.status, 'outline')
  applyOps(state, [{ op: 'schedule_item', id: item.id, scheduledAt: null }])
  assert.equal(item.status, 'idea', 'an idea without a draft goes back to idea when unscheduled')
  applyOps(state, [{ op: 'update_item', id: item.id, status: 'published' }])
  assert.ok(item.publishedAt, 'publishing through update_item records the publish time too')
  applyOps(state, [{ op: 'set_status', id: item.id, status: 'draft' }])
  assert.equal(item.publishedAt, undefined, 'leaving published clears the publish time')
  const sample = state.items.find(row => row.sample)
  const [child] = applyOps(state, [{ op: 'add_item', title: 'Hangs under the sample', parentId: sample.id }, { op: 'add_metric', itemId: sample.id, platform: 'Douyin', date: '2026-11-01T12:00:00Z', views: 10 }]).receipts
  applyOps(state, [{ op: 'clear_samples' }])
  assert.equal(state.items.find(row => row.id === child.target).parentId, null)
  assert.equal(state.metrics.length, 0)
})
