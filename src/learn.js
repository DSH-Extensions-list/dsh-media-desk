// Self-improvement: turn real numbers and your edits to drafts into writing rules.
// A rule only takes effect after you confirm it, and the active set can be exported as a DSH skill.
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { activeStyle, styleToVoice } from './style.js'
import { tr } from './i18n.js'

/** Bucket by this machine's local date, so a morning post isn't filed under the day before. */
function localDay(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso).slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (row[key] || 0), 0)
}

/** Running totals per item. */
function itemTotals(state) {
  const totals = new Map()
  for (const metric of state.metrics) {
    if (!metric.itemId) continue
    const entry = totals.get(metric.itemId) ?? { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
    for (const key of Object.keys(entry)) entry[key] += metric[key] || 0
    totals.set(metric.itemId, entry)
  }
  return totals
}

/** Once there is real data, the sample rows stop counting towards insights. */
function realMetrics(state) {
  const real = state.metrics.filter(metric => !metric.sample)
  return real.length ? real : state.metrics
}

function engagement(row) {
  return (row.likes || 0) + (row.comments || 0) + (row.shares || 0) + (row.saves || 0)
}

function bestGroup(rows) {
  const groups = new Map()
  for (const row of rows) {
    if (!row.key) continue
    const list = groups.get(row.key) ?? []
    list.push(row.value)
    groups.set(row.key, list)
  }
  const ranked = [...groups.entries()]
    .map(([key, values]) => ({ key, n: values.length, avg: values.reduce((a, b) => a + b, 0) / values.length }))
    .sort((a, b) => b.avg - a.avg)
  return ranked
}

/** Compare the model's draft with what you ended up with, and guess which way you edit. */
function editSignals(state) {
  const signals = []
  for (const item of state.items) {
    const production = item.production
    if (production?.aiArticle && production.article && production.article !== production.aiArticle) {
      const before = production.aiArticle.replace(/\s/g, '').length
      const after = production.article.replace(/\s/g, '').length
      signals.push({ title: item.title, ratio: before ? after / before : 1 })
    }
    for (const format of ['article', 'script']) {
      const draft = item.drafts?.[format]
      if (!draft?.aiText || draft.by !== 'user' || draft.text === draft.aiText) continue
      const before = draft.aiText.replace(/\s/g, '').length
      const after = draft.text.replace(/\s/g, '').length
      signals.push({ title: item.title, ratio: before ? after / before : 1 })
    }
  }
  return signals
}

/**
 * Propose rules from the data on hand. Only when there is enough of a sample,
 * so it never invents a pattern to fill the list.
 * @param {object} state - Current state.
 * @returns {Array<{name: string, rule: string, evidence: string, confidence: number, source: string}>} Proposals.
 */
export function proposeRules(state) {
  const proposals = []
  const totals = itemTotals({ metrics: realMetrics(state) })
  const published = state.items.filter(item => totals.has(item.id))
  const rows = published.map(item => ({ item, views: totals.get(item.id).views }))

  // Some platforms don't expose view counts publicly, so those rows can't join a cross-platform comparison.
  const byPlatform = bestGroup(rows.filter(row => row.views > 0).map(row => ({ key: row.item.platform, value: row.views })))
  if (byPlatform.length >= 2 && byPlatform[0].avg > byPlatform[1].avg * 1.3) {
    const best = byPlatform[0]
    const platform = best.key
    proposals.push({
      name: tr('Publish first on {platform}', { platform }), rule: tr('Publish each topic on {platform} first, then adapt it for the other platforms.', { platform }),
      evidence: tr('{platform} averages {avg} views, ahead of {second} in second place at {secondAvg}', { platform, avg: Math.round(best.avg).toLocaleString('en-US'), second: byPlatform[1].key, secondAvg: Math.round(byPlatform[1].avg).toLocaleString('en-US') }), confidence: Math.min(0.85, 0.4 + best.n * 0.12), source: tr('Insights'),
    })
  }

  const hasViews = rows.some(row => row.views > 0)
  const hours = bestGroup(published.filter(item => item.publishedAt).map(item => ({ key: String(new Date(item.publishedAt).getHours()), value: hasViews ? totals.get(item.id).views : engagement(totals.get(item.id)) })))
  if (hours.length >= 2 && hours[0].n >= 2) {
    proposals.push({
      name: tr('Publish around {hour}:00', { hour: hours[0].key }), rule: tr('Schedule posts around {hour}:00 by default.', { hour: hours[0].key }),
      evidence: tr(hasViews ? '{n} posts in this slot average {avg} views' : '{n} posts in this slot average {avg} engagements', { n: hours[0].n, avg: Math.round(hours[0].avg).toLocaleString('en-US') }), confidence: 0.5, source: tr('Insights'),
    })
  }

  const edits = editSignals(state)
  if (edits.length >= 2) {
    const avg = edits.reduce((a, b) => a + b.ratio, 0) / edits.length
    if (avg < 0.85) {
      proposals.push({ name: tr('Shorter first drafts'), rule: tr('You usually cut AI drafts to {pct}% of their length, so first drafts should be tighter.', { pct: Math.round(avg * 100) }), evidence: tr('From {n} draft edits', { n: edits.length }), confidence: Math.min(0.9, 0.5 + edits.length * 0.08), source: tr('Draft edits') })
    } else if (avg > 1.15) {
      proposals.push({ name: tr('More detail in first drafts'), rule: tr('You usually expand AI drafts to {pct}% of their length, so first drafts should bring more specific details and examples.', { pct: Math.round(avg * 100) }), evidence: tr('From {n} draft edits', { n: edits.length }), confidence: Math.min(0.9, 0.5 + edits.length * 0.08), source: tr('Draft edits') })
    }
  }

  const known = new Set(state.skills.map(skill => skill.name))
  return proposals.filter(row => !known.has(row.name))
}

/**
 * The summary the Review page renders.
 * @param {object} state - Current state.
 * @returns {object} Totals, trend, platform split, leaderboard and angle x persona coverage.
 */
export function computeInsights(state) {
  const metrics = realMetrics(state)
  const onlyReal = metrics.length !== state.metrics.length || !metrics.some(metric => metric.sample)
  const totals = itemTotals({ metrics })
  const daily = new Map()
  for (const metric of metrics) {
    const day = localDay(metric.date)
    const entry = daily.get(day) ?? { date: day, views: 0, engaged: 0 }
    entry.views += metric.views || 0
    entry.engaged += engagement(metric)
    daily.set(day, entry)
  }
  const platforms = new Map()
  for (const metric of metrics) {
    const entry = platforms.get(metric.platform) ?? { platform: metric.platform, views: 0, engaged: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
    for (const key of ['views', 'likes', 'comments', 'shares', 'saves']) entry[key] += metric[key] || 0
    entry.engaged += engagement(metric)
    platforms.set(metric.platform, entry)
  }
  const top = state.items
    .filter(item => totals.has(item.id))
    .map(item => ({ id: item.id, title: item.title, platform: item.platform, ...totals.get(item.id), engaged: engagement(totals.get(item.id)) }))
    .sort((a, b) => (b.views - a.views) || (b.engaged - a.engaged))
  const views = sum(metrics, 'views')
  const engaged = metrics.reduce((total, metric) => total + engagement(metric), 0)
  // Engagement rate only counts rows that report views, otherwise the fraction is meaningless.
  const withViews = metrics.filter(metric => metric.views > 0)
  const accounts = state.accounts.filter(account => (onlyReal ? !account.sample : true))
  return {
    views, engaged, engagementRate: views ? withViews.reduce((total, metric) => total + engagement(metric), 0) / views : 0,
    published: state.items.filter(item => item.status === 'published' && (onlyReal ? !item.sample : true)).length,
    followers: sum(accounts, 'followers'), daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)), platforms: [...platforms.values()].sort((a, b) => (b.views - a.views) || (b.engaged - a.engaged)), top,
    hasSample: metrics.some(metric => metric.sample),
  }
}

function slug(text, fallback) {
  const ascii = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return ascii || fallback
}

/**
 * Write the active rules out as a user-level DSH skill (<home>/skills/<name>/SKILL.md).
 * Nothing is written until the user confirms in the interface and clicks export.
 * @param {object} state - Current state.
 * @param {string} home - DSH_HOME.
 * @returns {Promise<{name: string, path: string, rules: number}>} What was written.
 */
export async function exportSkill(state, home) {
  // Sample rules aren't the author's own voice, so they never go into a real skill.
  const rules = state.skills.filter(skill => !skill.sample && (skill.status === 'active' || skill.status === 'exported'))
  const picked = activeStyle(state)
  const style = picked && !picked.preset ? picked : null
  const name = 'media-desk-voice'
  const dir = join(home, 'skills', name)
  if (!rules.length && !style) {
    // An older exported skill no longer reflects the current rules, so take it down.
    await rm(dir, { recursive: true, force: true })
    throw Object.assign(new Error(tr('You don\'t have your own style or writing rules yet. Sample rules and presets are never exported.')), { status: 400 })
  }
  await mkdir(dir, { recursive: true })
  const description = tr('The author\'s social media writing style and rules. Use it when writing topics, scripts, titles or cover text.')
  const styleBlock = style ? `## ${tr('Style: {name}', { name: style.name })}\n\n${styleToVoice(style)}\n\n` : ''
  const ruleBlock = rules.length ? `## ${tr('Rules to follow')}\n\n${rules.map(r => `- **${r.name}**: ${r.rule}${r.evidence ? tr(' (based on: {evidence})', { evidence: r.evidence }) : ''}`).join('\n')}\n` : ''
  const body = `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${tr('Writing style')}\n\n${tr('Generated by Media Desk. Updated {date}.', { date: new Date().toISOString().slice(0, 10) })}\n\n${styleBlock}${ruleBlock}`
  await writeFile(join(dir, 'SKILL.md'), body)
  return { name, path: join(dir, 'SKILL.md'), rules: rules.length, slug: slug(name, 'media-desk') }
}
