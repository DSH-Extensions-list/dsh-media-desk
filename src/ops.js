// The workbench's single write path: chat and UI actions both go through it, so
// fields are validated and receipts produced in one place.
// Model output is untrusted input too, so only whitelisted fields get through.
import { DRAFT_FORMATS, DRAFT_IDENTITIES } from './draft-brief.js'
import { tr } from './i18n.js'

export const STATUSES = ['idea', 'outline', 'draft', 'ready', 'published']
export const STATUS_LABEL = { idea: 'Idea', outline: 'Outline', draft: 'Draft', ready: 'Ready', published: 'Published' }
export const KINDS = ['image', 'video', 'web', 'quote', 'note']
export const PLATFORMS = ['Instagram', 'X', 'Reddit']

/** The display name of a status. */
export function statusLabel(status) {
  return STATUS_LABEL[status] ?? String(status)
}

const ITEM_FIELDS = {
  draftIdentity: 'draftIdentity', draftFormat: 'draftFormat', draftBrand: 'shortText', draftStyleId: 'id',
  title: 'text', body: 'text', kind: 'kind', url: 'url', source: 'text', tags: 'list', status: 'status', angleId: 'id',
  personaIds: 'list', parentId: 'id', rel: 'text', scheduledAt: 'date', platform: 'platform', pinned: 'bool', media: 'media', pos: 'pos', score: 'num',
}
const PERSON_FIELDS = { name: 'text', role: 'text', note: 'text', traits: 'list', tone: 'num' }
const ANGLE_FIELDS = { name: 'text', hook: 'text', prompt: 'text' }
const STYLE_FIELDS = { name: 'text', icon: 'text', summary: 'text', tone: 'text', sentences: 'text', opening: 'text', structure: 'text', words: 'list', avoid: 'list', samples: 'list' }
const SKILL_FIELDS = { name: 'text', rule: 'text', source: 'text', status: 'text', confidence: 'num', evidence: 'text' }
const METRIC_FIELDS = { itemId: 'id', platform: 'platform', date: 'date', views: 'num', likes: 'num', comments: 'num', shares: 'num', saves: 'num' }
const ACCOUNT_FIELDS = { platform: 'text', handle: 'text', url: 'url', followers: 'num', note: 'text', title: 'text', description: 'text', avatar: 'url', fetchedAt: 'date', fetchError: 'text' }

let counter = 0
export function newId(prefix = 'x') {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

function coerce(type, value) {
  switch (type) {
    case 'draftIdentity': return DRAFT_IDENTITIES.includes(value) ? value : undefined
    case 'draftFormat': return DRAFT_FORMATS.includes(value) ? value : undefined
    case 'shortText': return typeof value === 'string' ? value.trim().slice(0, 100) : undefined
    case 'text': return typeof value === 'string' ? value.slice(0, 40000) : undefined
    case 'id': return value === null || typeof value === 'string' ? value : undefined
    case 'kind': return KINDS.includes(value) ? value : undefined
    case 'status': return STATUSES.includes(value) ? value : undefined
    case 'platform': return value === null || PLATFORMS.includes(value) ? value : undefined
    case 'list': return Array.isArray(value) ? value.filter(v => typeof v === 'string').slice(0, 24) : undefined
    case 'bool': return typeof value === 'boolean' ? value : undefined
    case 'num': return Number.isFinite(value) ? value : undefined
    case 'url': return value === null || value === '' ? null : isHttpUrl(value) ? value : undefined
    case 'date': return value === null ? null : typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : undefined
    case 'pos': return value && [value.x, value.y].every(Number.isFinite) ? { x: value.x, y: value.y, r: Number.isFinite(value.r) ? value.r : 0 } : undefined
    case 'media': {
      if (value === null) return null
      if (!value || typeof value.src !== 'string') return undefined
      // Media may only point at the plugin's own relative paths or http(s) URLs
      const local = /^media-desk\/(assets|files)\/[\w.-]+$/.test(value.src)
      if (!local && !isHttpUrl(value.src)) return undefined
      const poster = typeof value.poster === 'string' && (/^media-desk\/(assets|files)\/[\w.-]+$/.test(value.poster) || isHttpUrl(value.poster)) ? value.poster : undefined
      return { src: value.src, ...(poster ? { poster } : {}), ...(Number.isFinite(value.w) ? { w: value.w } : {}), ...(Number.isFinite(value.h) ? { h: value.h } : {}) }
    }
    default: return undefined
  }
}

function pick(fields, input) {
  const out = {}
  for (const [key, type] of Object.entries(fields)) {
    if (input?.[key] === undefined) continue
    const value = coerce(type, input[key])
    if (value !== undefined) out[key] = value
  }
  return out
}

function findById(list, id) {
  const entry = list.find(row => row.id === id)
  if (!entry) throw new Error(tr('Not found: {id}', { id }))
  return entry
}

function short(text, n = 22) {
  const s = String(text || '').trim()
  return s.length > n ? `${s.slice(0, n)}…` : s
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtWhen(iso) {
  if (!iso) return tr('Not scheduled')
  const d = new Date(iso)
  const pad = v => String(v).padStart(2, '0')
  return `${fmtShort(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtShort(iso) {
  const d = new Date(iso)
  return `${MONTHS_EN[d.getMonth()]} ${d.getDate()}`
}

/** Keep the publish time in step with status: set it on publish, clear it on the way out. */
function applyStatus(item, status) {
  item.status = status
  if (status === 'published' && !item.publishedAt) item.publishedAt = new Date().toISOString()
  if (status !== 'published') delete item.publishedAt
}

/** Scheduling means ready to publish (outline without a draft); unscheduling steps it back. Published items are left alone. */
function applySchedule(item, when) {
  item.scheduledAt = when
  if (item.status === 'published') return
  const produced = item.production?.status === 'done'
  if (when) item.status = produced || ['draft', 'ready'].includes(item.status) ? 'ready' : 'outline'
  else if (item.status === 'ready') item.status = 'draft'
  else if (item.status === 'outline' && !produced) item.status = 'idea'
}

const handlers = {
  add_item(state, op, now) {
    const fields = pick(ITEM_FIELDS, op)
    const item = {
      id: newId('it'), kind: 'note', title: '', body: '', tags: [], status: 'idea', personaIds: [], createdAt: now, drafts: {}, ...fields,
    }
    if (!item.title && !item.body && !item.media) throw new Error(tr('The idea is empty'))
    // Even an image or video needs a title, so cards and receipts have something to show
    if (!item.title) item.title = short(item.body, 28) || (item.media ? tr(item.kind === 'video' ? 'Video from {date}' : 'Image from {date}', { date: fmtShort(now) }) : '')
    // New ideas land beside the hero text: visible at a glance without disturbing the layout
    if (!item.pos && !item.parentId) {
      const n = state.items.filter(row => !row.parentId && row.pos).length
      const scale = 1 + (n % 6) * 0.2
      item.pos = { x: Math.round(Math.cos(n * 2.39996) * 580 * scale), y: Math.round(Math.sin(n * 2.39996) * 340 * scale), r: ((n % 5) - 2) * 1.2 }
    }
    if (item.scheduledAt) applySchedule(item, item.scheduledAt)
    if (item.status === 'published') applyStatus(item, 'published')
    state.items.unshift(item)
    return { text: tr('Saved idea "{title}"', { title: short(item.title) }), target: item.id, kind: 'item' }
  },
  update_item(state, op) {
    const item = findById(state.items, op.id)
    const { status, scheduledAt, ...fields } = pick(ITEM_FIELDS, op)
    Object.assign(item, fields)
    if (scheduledAt !== undefined) applySchedule(item, scheduledAt)
    if (status !== undefined) applyStatus(item, status)
    const names = [...Object.keys(fields), ...(status !== undefined ? ['status'] : []), ...(scheduledAt !== undefined ? ['scheduledAt'] : [])].filter(key => key !== 'pos')
    return names.length ? { text: tr('Updated "{title}"', { title: short(item.title) }), target: item.id, kind: 'item' } : null
  },
  delete_item(state, op) {
    const item = findById(state.items, op.id)
    state.items = state.items.filter(row => row.id !== op.id)
    for (const child of state.items) if (child.parentId === op.id) child.parentId = item.parentId ?? null
    state.metrics = state.metrics.filter(row => row.itemId !== op.id)
    return { text: tr('Delete “{title}”', { title: short(item.title) }) }
  },
  schedule_item(state, op) {
    const item = findById(state.items, op.id)
    const when = coerce('date', op.scheduledAt)
    if (when === undefined) throw new Error(tr('Invalid schedule time'))
    const platform = coerce('platform', op.platform)
    if (platform !== undefined) item.platform = platform
    applySchedule(item, when)
    return { text: when ? tr('Scheduled "{title}" for {when}', { title: short(item.title), when: fmtWhen(when) }) + (item.platform ? ` · ${item.platform}` : '') : tr('Unscheduled "{title}"', { title: short(item.title) }), target: item.id, kind: 'item' }
  },
  set_status(state, op) {
    const item = findById(state.items, op.id)
    const status = coerce('status', op.status)
    if (!status) throw new Error(tr('Invalid status'))
    applyStatus(item, status)
    return { text: tr('Moved "{title}" to {status}', { title: short(item.title), status: statusLabel(status) }), target: item.id, kind: 'item' }
  },
  save_draft(state, op, now) {
    const item = findById(state.items, op.id)
    const format = op.format === 'script' ? 'script' : 'article'
    if (typeof op.text !== 'string') throw new Error(tr('Invalid draft'))
    const previous = item.drafts?.[format]
    item.drafts = { ...item.drafts, [format]: { text: op.text.slice(0, 200000), by: op.by === 'ai' ? 'ai' : 'user', engine: typeof op.engine === 'string' ? op.engine : undefined, at: now, aiText: op.by === 'ai' ? op.text : previous?.aiText } }
    if (['idea', 'outline'].includes(item.status)) item.status = 'draft'
    return { text: tr(format === 'script' ? 'Saved the script for "{title}"' : 'Saved the article for "{title}"', { title: short(item.title) }), target: item.id, kind: 'item' }
  },
  update_production(state, op) {
    const item = findById(state.items, op.id)
    if (!item.production) throw new Error(tr('This idea hasn\'t been drafted yet'))
    if (typeof op.title === 'string') item.production.title = op.title.slice(0, 200)
    if (typeof op.coverText === 'string') item.production.coverText = op.coverText.slice(0, 40)
    if (typeof op.article === 'string') item.production.article = op.article.slice(0, 200000)
    return { text: tr('Edited "{title}"', { title: short(item.production.title) }), target: item.id, kind: 'item' }
  },
  add_person(state, op, now) {
    const person = { id: newId('p'), name: '', role: tr('Target reader'), note: '', traits: [], tone: Math.floor(Math.random() * 6), createdAt: now, ...pick(PERSON_FIELDS, op) }
    if (!person.name) throw new Error(tr('A person needs a name'))
    state.people.push(person)
    return { text: tr('Added person "{name}"', { name: person.name }), target: person.id, kind: 'person' }
  },
  update_person(state, op) {
    const person = findById(state.people, op.id)
    Object.assign(person, pick(PERSON_FIELDS, op))
    return { text: tr('Updated person "{name}"', { name: person.name }), target: person.id, kind: 'person' }
  },
  delete_person(state, op) {
    const person = findById(state.people, op.id)
    state.people = state.people.filter(row => row.id !== op.id)
    for (const item of state.items) item.personaIds = (item.personaIds || []).filter(id => id !== op.id)
    return { text: tr('Deleted person "{name}"', { name: person.name }) }
  },
  add_angle(state, op, now) {
    const angle = { id: newId('a'), name: '', hook: '', prompt: '', createdAt: now, ...pick(ANGLE_FIELDS, op) }
    if (!angle.name) throw new Error(tr('An angle needs a name'))
    state.angles.push(angle)
    return { text: tr('Added angle "{name}"', { name: angle.name }), target: angle.id, kind: 'angle' }
  },
  update_angle(state, op) {
    const angle = findById(state.angles, op.id)
    Object.assign(angle, pick(ANGLE_FIELDS, op))
    return { text: tr('Updated angle "{name}"', { name: angle.name }), target: angle.id, kind: 'angle' }
  },
  delete_angle(state, op) {
    const angle = findById(state.angles, op.id)
    state.angles = state.angles.filter(row => row.id !== op.id)
    for (const item of state.items) if (item.angleId === op.id) item.angleId = null
    return { text: tr('Deleted angle "{name}"', { name: angle.name }) }
  },
  add_style(state, op, now) {
    const style = { id: newId('st'), source: tr('Manual'), createdAt: now, words: [], avoid: [], samples: [], ...pick(STYLE_FIELDS, op) }
    if (!style.name) throw new Error(tr('A style needs a name'))
    state.styles = [style, ...(state.styles ?? [])]
    return { text: tr('Added style "{name}"', { name: style.name }), target: style.id, kind: 'style' }
  },
  update_style(state, op) {
    const style = findById(state.styles ?? [], op.id)
    Object.assign(style, pick(STYLE_FIELDS, op))
    return { text: tr('Updated style "{name}"', { name: style.name }) }
  },
  delete_style(state, op) {
    const style = findById(state.styles ?? [], op.id)
    state.styles = state.styles.filter(row => row.id !== op.id)
    if (state.activeStyleId === op.id) state.activeStyleId = null
    return { text: tr('Delete style “{name}”', { name: style.name }) }
  },
  set_style(state, op) {
    if (op.id === null) {
      state.activeStyleId = null
      return { text: tr('No longer using a specific style') }
    }
    const style = findById(state.styles ?? [], op.id)
    state.activeStyleId = style.id
    return { text: tr('Writing in the "{name}" style from now on', { name: style.name }) }
  },
  add_skill(state, op, now) {
    const skill = { id: newId('s'), name: '', rule: '', source: tr('Chat'), status: 'proposed', confidence: 0.5, createdAt: now, ...pick(SKILL_FIELDS, op) }
    if (!skill.name || !skill.rule) throw new Error(tr('A writing rule needs a name and a rule'))
    state.skills.unshift(skill)
    return { text: tr('Added writing rule "{name}"', { name: skill.name }), target: skill.id, kind: 'skill' }
  },
  update_skill(state, op) {
    const skill = findById(state.skills, op.id)
    Object.assign(skill, pick(SKILL_FIELDS, op))
    return { text: tr('Updated writing rule "{name}"', { name: skill.name }), target: skill.id, kind: 'skill' }
  },
  delete_skill(state, op) {
    const skill = findById(state.skills, op.id)
    state.skills = state.skills.filter(row => row.id !== op.id)
    return { text: tr('Delete rule “{name}”', { name: skill.name }) }
  },
  add_metric(state, op) {
    const metric = { id: newId('m'), date: new Date().toISOString(), views: 0, likes: 0, comments: 0, shares: 0, saves: 0, ...pick(METRIC_FIELDS, op) }
    if (!metric.platform) throw new Error(tr('Numbers need a platform'))
    state.metrics.push(metric)
    return { text: tr('Logged {views} views on {platform}', { platform: metric.platform, views: metric.views }) }
  },
  add_account(state, op, now) {
    const account = { id: newId('ac'), platform: '', handle: '', url: null, followers: null, createdAt: now, ...pick(ACCOUNT_FIELDS, op) }
    if (!account.platform && !account.handle && !account.url) throw new Error(tr('The account details are empty'))
    state.accounts.push(account)
    return { text: tr('Added account profile "{name}"', { name: account.handle || account.title || account.platform }), target: account.id, kind: 'account' }
  },
  update_account(state, op) {
    const account = findById(state.accounts, op.id)
    Object.assign(account, pick(ACCOUNT_FIELDS, op))
    return { text: tr('Updated account profile "{name}"', { name: account.handle || account.title || account.platform }) }
  },
  delete_account(state, op) {
    findById(state.accounts, op.id)
    state.accounts = state.accounts.filter(row => row.id !== op.id)
    return { text: tr('Deleted account profile') }
  },
  clear_samples(state) {
    state.items = state.items.filter(row => !row.sample)
    state.people = state.people.filter(row => !row.sample)
    state.angles = state.angles.filter(row => !row.sample)
    state.metrics = state.metrics.filter(row => !row.sample)
    state.accounts = state.accounts.filter(row => !row.sample)
    state.skills = state.skills.filter(row => !row.sample)
    state.styles = (state.styles ?? []).filter(row => !row.sample)
    if (!state.styles.some(row => row.id === state.activeStyleId)) state.activeStyleId = null
    // User data can hang off sample content: detach items whose parent is gone, drop metrics whose item is gone
    const ids = new Set(state.items.map(row => row.id))
    for (const row of state.items) if (row.parentId && !ids.has(row.parentId)) row.parentId = null
    state.metrics = state.metrics.filter(row => !row.itemId || ids.has(row.itemId))
    state.sampleCleared = true
    return { text: tr('Cleared all sample data') }
  },
}

/**
 * Apply a batch of operations in order. One failure doesn't roll back the ones that
 * succeeded; failures go into the receipts.
 * @param {object} state - State to modify in place.
 * @param {Array<object>} ops - Operations to apply.
 * @returns {{receipts: Array<object>, errors: string[]}} User-facing receipts.
 */
export function applyOps(state, ops) {
  const receipts = []
  const errors = []
  const now = new Date().toISOString()
  for (const op of Array.isArray(ops) ? ops : []) {
    const handler = Object.hasOwn(handlers, op?.op) ? handlers[op.op] : undefined
    if (!handler) {
      errors.push(tr('Unsupported operation: {op}', { op: String(op?.op) }))
      continue
    }
    try {
      const receipt = handler(state, op, now)
      if (receipt) receipts.push(receipt)
    } catch (err) {
      errors.push(err.message)
    }
  }
  return { receipts, errors }
}
