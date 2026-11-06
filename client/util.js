import { t } from './i18n.js'

// Display names. Call sites wrap them in t() so the wording lives in one place.
export const STATUSES = ['idea', 'outline', 'draft', 'ready', 'published']
export const STATUS_LABEL = { idea: 'Idea', outline: 'Outline', draft: 'Draft', ready: 'Ready', published: 'Published' }
export const KIND_LABEL = { image: 'Image', video: 'Video', web: 'Web', quote: 'Quote', note: 'Note' }
export const PLATFORMS = ['Instagram', 'X', 'Reddit']
/** Platform dropdown order: the three supported platforms, in a fixed order. */
export function platformChoices() {
  return [...PLATFORMS]
}
export const STYLE_CATEGORIES = ['Tech', 'Travel & food', 'Lifestyle', 'Opinion', 'Tutorials', 'Reviews', 'Stories', 'News']

export function styleIcon(style) {
  return style?.icon || '✍️'
}
export const PLATFORM_URL = {
  Instagram: 'https://www.instagram.com/', X: 'https://x.com/compose/post', Reddit: 'https://www.reddit.com/submit',
}

export function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function seeded(seed) {
  let s = seed || 1
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507)
    s = Math.imul(s ^ (s >>> 13), 3266489909)
    s ^= s >>> 16
    return (s >>> 0) / 4294967296
  }
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Sample a spring response into a CSS linear() easing usable by WAAPI and CSS. */
export function springEasing(stiffness = 170, damping = 20, mass = 1) {
  const w0 = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  const wd = w0 * Math.sqrt(Math.max(1 - zeta * zeta, 1e-4))
  const at = t => 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
  let duration = 0.1
  while (duration < 4 && (Math.abs(at(duration) - 1) > 0.002 || Math.abs(at(duration + 0.05) - 1) > 0.002)) duration += 0.05
  const points = []
  const N = 36
  for (let i = 0; i <= N; i += 1) points.push(Number(at((i / N) * duration).toFixed(4)))
  points[N] = 1
  return { easing: `linear(${points.join(',')})`, duration: Math.round(duration * 1000) }
}

export const SPRING_SOFT = springEasing(120, 16)
export const SPRING_SNAP = springEasing(260, 24)

export function dayKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function pad(n) {
  return String(n).padStart(2, '0')
}

export function fmtTime(iso) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDate(iso) {
  const d = new Date(iso)
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
}

export function fmtWhen(iso) {
  if (!iso) return t('Not scheduled')
  return `${fmtDate(iso)} ${fmtTime(iso)}`
}

export function relativeDay(iso) {
  const diff = Math.round((new Date(dayKey(iso)) - new Date(dayKey(new Date()))) / 86400000)
  if (diff === 0) return t('Today')
  if (diff === 1) return t('Tomorrow')
  if (diff === 2) return t('In 2 days')
  if (diff === -1) return t('Yesterday')
  if (diff < 0 && diff > -8) return t('{n} days ago', { n: -diff })
  return fmtDate(iso)
}

export function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function compact(n) {
  if (n === null || n === undefined) return '—'
  // K / M, without a trailing .0
  const short = (value, suffix) => `${value.toFixed(value >= 100 ? 0 : 1).replace(/\.0$/, '')}${suffix}`
  if (n >= 999500) return short(n / 1000000, 'M')
  if (n >= 10000) return short(n / 1000, 'K')
  return n.toLocaleString('en-US')
}

/** The unit that follows a count. */
export function unit(n, word) {
  return t(word)
}

/** The wall and stamps only show ideas you noted yourself; imported posts don't count. */
export function isIdea(item) {
  return !item.parentId && !item.imported
}

/** Streak of days recorded: when today is empty, count back from yesterday so the morning doesn't break it. */
export function computeStreak(items, now = new Date()) {
  const days = new Set(items.filter(isIdea).map(i => dayKey(i.createdAt)))
  const cursor = new Date(now)
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Once a draft exists, the card shows its cover and final title. */
export function displayItem(item) {
  const production = item.production
  if (!production?.title || production.status === 'running') return item
  const src = production.cover?.src
  return { ...item, title: production.title, ...(src ? { kind: 'image', media: { src, w: 3, h: 2 } } : {}) }
}

export function posterOf(item) {
  if (!item.media) return null
  return item.media.poster || (item.kind === 'video' ? null : item.media.src)
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

/** Minimal Markdown for draft previews: escape first, then structure, so HTML in model output never runs. */
export function renderMarkdown(source) {
  const lines = source.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*$/.test(line)) { i += 1; continue }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) { out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); i += 1; continue }
    if (/^>\s?/.test(line)) {
      const quote = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { quote.push(inline(lines[i].replace(/^>\s?/, ''))); i += 1 }
      out.push(`<blockquote>${quote.join('<br>')}</blockquote>`)
      continue
    }
    if (/^\|.*\|\s*$/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()))
      const head = cells(line)
      i += 2
      const body = []
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) { body.push(cells(lines[i])); i += 1 }
      out.push(`<table><thead><tr>${head.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
      continue
    }
    if (/^\s*([-*·]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const rows = []
      while (i < lines.length && /^\s*([-*·]|\d+\.)\s+/.test(lines[i])) { rows.push(`<li>${inline(lines[i].replace(/^\s*([-*·]|\d+\.)\s+/, ''))}</li>`); i += 1 }
      out.push(ordered ? `<ol>${rows.join('')}</ol>` : `<ul>${rows.join('')}</ul>`)
      continue
    }
    const para = []
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|>|\|)/.test(lines[i]) && !/^\s*([-*·]|\d+\.)\s+/.test(lines[i])) { para.push(inline(lines[i])); i += 1 }
    if (para.length) out.push(`<p>${para.join('<br>')}</p>`)
    else { out.push(`<p>${inline(line)}</p>`); i += 1 }
  }
  return out.join('')
}

/** Body length in words. */
export function textLength(text) {
  return (text.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || []).length
}
