// Local rule parser: with no model available the conversation still handles common
// commands, and the UI marks the result as coming from local rules.
import { tr } from './i18n.js'
import { fmtWhen, STATUSES } from './ops.js'

const WEEK_EN = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const MONTH_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const PLATFORM_WORDS = { instagram: 'Instagram', ig: 'Instagram', twitter: 'X', x: 'X', reddit: 'Reddit', r: 'Reddit' }

/** Dates and times in English: tomorrow 8pm, next wed, Nov 3 20:00, in 3 days. */
export function parseWhen(text, now = new Date()) {
  const date = new Date(now)
  let matched = false
  let m
  if (/\bday after tomorrow\b/i.test(text)) { date.setDate(date.getDate() + 2); matched = true }
  else if (/\btomorrow\b/i.test(text)) { date.setDate(date.getDate() + 1); matched = true }
  else if (/\b(today|tonight|this (morning|afternoon|evening))\b/i.test(text)) { matched = true }
  else if ((m = /\b(next\s+)?(mon|tue|wed|thu|fri|sat|sun)(?:day|s|sday|nesday|rsday|urday|r|rs)?\b/i.exec(text))) {
    const target = WEEK_EN[m[2].toLowerCase()]
    const current = date.getDay()
    let delta = (target - current + 7) % 7
    if (m[1]) delta = ((target + 6) % 7) + (7 - ((current + 6) % 7))
    else if (delta === 0) delta = 7
    date.setDate(date.getDate() + delta)
    matched = true
  } else if ((m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(text))) {
    date.setMonth(MONTH_EN.indexOf(m[1].toLowerCase()), Number(m[2]))
    if (date < now) date.setFullYear(date.getFullYear() + 1)
    matched = true
  } else if ((m = /\bin\s+(\d+)\s+days?\b/i.exec(text))) {
    date.setDate(date.getDate() + Number(m[1]))
    matched = true
  }

  let hour = null
  let minute = 0
  if ((m = /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i.exec(text))) {
    hour = Number(m[1])
    minute = Number(m[2])
    if (m[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12
    if (m[3]?.toLowerCase() === 'am' && hour === 12) hour = 0
  } else if ((m = /\b(\d{1,2})\s*(am|pm)\b/i.exec(text))) {
    hour = Number(m[1]) % 12 + (m[2].toLowerCase() === 'pm' ? 12 : 0)
  } else if ((m = /\b(noon|midday)\b/i.exec(text))) {
    hour = 12
  } else if ((m = /\bat\s+(\d{1,2})\b/i.exec(text))) {
    hour = Number(m[1])
    if (/\b(tonight|evening|afternoon)\b/i.test(text) && hour < 12) hour += 12
  }
  if (hour !== null) matched = true
  else if (matched) hour = /\bmorning\b/i.test(text) ? 9 : /\bafternoon\b/i.test(text) ? 15 : 20
  if (!matched) return null
  date.setHours(hour, minute, 0, 0)
  return date
}

const STOP_WORDS = new Set(['this', 'that', 'with', 'from', 'into', 'about', 'please', 'schedule', 'tomorrow', 'tonight', 'write', 'script', 'delete', 'remove', 'rename', 'title', 'mark', 'make'])

/** English matches on whole words, not bigrams, so letter pairs like "to" or "in" don't hit by accident. */
function wordScore(item, query) {
  const title = item.title.toLowerCase()
  return query.toLowerCase().split(/[^a-z0-9']+/).filter(word => word.length >= 4 && !STOP_WORDS.has(word) && title.includes(word)).length
}

function score(item, query) {
  const title = item.title.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return 0
  if (title === q) return 1000
  if (title.includes(q)) return 500 + q.length
  return wordScore(item, q)
}

/** Prefer a quoted title, then the focused card, then a fuzzy match. */
function resolveItem(state, text, focusId) {
  const quoted = /[“"]([^”"]+)[”"]/.exec(text)
  if (quoted) {
    const best = [...state.items].sort((a, b) => score(b, quoted[1]) - score(a, quoted[1]))[0]
    if (best && score(best, quoted[1]) > 0) return best
    return null
  }
  if (/\b(this|it|current)\b/i.test(text) && focusId) return state.items.find(i => i.id === focusId) ?? null
  const best = [...state.items].sort((a, b) => wordScore(b, text) - wordScore(a, text))[0]
  if (best && wordScore(best, text) >= 2) return best
  return focusId ? state.items.find(i => i.id === focusId) ?? null : null
}

function agenda(state, now) {
  const upcoming = state.items
    .filter(i => i.scheduledAt && new Date(i.scheduledAt) >= now && i.status !== 'published')
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
    .slice(0, 5)
  if (!upcoming.length) return tr('Nothing is scheduled yet.')
  return `${tr('Coming up:')}\n${upcoming.map(i => `· ${fmtWhen(i.scheduledAt)} ${i.platform ?? ''} ${tr('"{title}"', { title: i.title })}`).join('\n')}`
}

/**
 * @param {object} state - Current state.
 * @param {string} message - User input.
 * @param {{focusId?: string, now?: Date}} [options]
 * @returns {{reply: string, ops: Array<object>, actions?: Array<object>}} Reply and pending operations.
 */
export function localIntent(state, message, { focusId, now = new Date() } = {}) {
  const text = message.trim()
  let m

  if (/\b(schedule|agenda|calendar|upcoming|coming up)\b/i.test(text) && /^(what|what's|whats|show|list|my|any|see)\b|^(schedule|agenda|calendar|upcoming)\??$/i.test(text)) {
    return { reply: agenda(state, now), ops: [] }
  }
  m = /^(?:note|jot(?: down)?|save|new idea|add (?:an )?idea|idea)\s*[:,-]\s*(.+)$/is.exec(text)
  if (m) {
    return { reply: tr('Saved. It\'s on the idea wall.'), ops: [{ op: 'add_item', kind: 'note', body: m[1].trim(), title: m[1].trim().split(/[.!?](?:\s|$)|\n/)[0].slice(0, 40) }] }
  }
  m = /^(?:from now on|going forward|always|rule|remember)\s*[:,-]?\s+(.+)$/is.exec(text)
  if (m) {
    return { reply: tr('Got it. I added it as a writing rule for you to review.'), ops: [{ op: 'add_skill', name: m[1].trim().slice(0, 18), rule: m[1].trim(), source: tr('Chat'), status: 'proposed', confidence: 0.6 }] }
  }

  const item = resolveItem(state, text, focusId)

  // In English, move/set can also mean a status change; only treat it as scheduling when a time parses.
  if (/^schedule\b/i.test(text) || (/^(?:move|put|set|publish|post)\b/i.test(text) && parseWhen(text, now))) {
    const when = parseWhen(text, now)
    if (!when) return { reply: tr('I couldn\'t find a time. Try "tomorrow 8pm" or "Nov 3 20:00".'), ops: [] }
    if (!item) return { reply: tr('Which piece should I schedule? Put its title in quotes.'), ops: [] }
    const word = /\b(instagram|ig|twitter|x|reddit|r)\b/i.exec(text)?.[1]?.replace(/\s+/g, ' ')
    const platform = word ? PLATFORM_WORDS[word.toLowerCase()] : ['Instagram', 'X', 'Reddit'].find(p => p.length > 1 && text.toLowerCase().includes(p.toLowerCase()))
    return { reply: tr('Scheduled.'), ops: [{ op: 'schedule_item', id: item.id, scheduledAt: when.toISOString(), ...(platform ? { platform } : {}) }] }
  }
  if (/\b(?:write|turn|make|produce|draft)\b.*\b(?:script|article|post|storyboard|figures?)\b|^(?:produce|write)(?: it| this)?\b|\bstoryboard\b/i.test(text)) {
    if (!item) return { reply: tr('Which idea should I draft? For example: write "Title".'), ops: [] }
    return { reply: tr('Drafting "{title}".', { title: item.title }), ops: [], actions: [{ type: 'produce', id: item.id }] }
  }
  const EN_STATUS = /\b(?:mark|set|change|move)\b.*\b(?:as|to)\s+(?:an?\s+)?(idea|outline|draft|ready|published)\b/i.exec(text)
  if (EN_STATUS) {
    if (!item) return { reply: tr('I couldn\'t find that piece. Put its title in quotes.'), ops: [] }
    return { reply: tr('Done.'), ops: [{ op: 'set_status', id: item.id, status: EN_STATUS[1].toLowerCase() }] }
  }
  // In English the quoted text is the new title, not the piece to change, so prefer the focused card.
  if ((m = /^(?:rename|retitle)(?:\s+(?:it|this))?(?:\s+to)?\s*[“"]?([^”"]+?)[”"]?$|\btitle to\s*[“"]?([^”"]+?)[”"]?$/i.exec(text))) {
    const target = (focusId ? state.items.find(i => i.id === focusId) : null) ?? item
    if (target) return { reply: tr('Done.'), ops: [{ op: 'update_item', id: target.id, title: (m[1] ?? m[2]).trim() }] }
  }
  if (/^(?:delete|remove)\b/i.test(text) && item) {
    return { reply: tr('Deleted. You can undo it anytime.'), ops: [{ op: 'delete_item', id: item.id }] }
  }
  const counts = STATUSES.map(s => state.items.filter(i => i.status === s).length)
  return {
    reply: tr('Local rules couldn\'t handle that (ideas: {ideas}, drafts: {drafts}). Connect a model and you can say anything. For now, try: note: ... / schedule "Title" for tomorrow 8pm / write "Title".', { ideas: counts[0], drafts: counts[2] }),
    ops: [],
  }
}
