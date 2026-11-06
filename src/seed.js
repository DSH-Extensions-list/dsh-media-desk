// Sample data for a fresh install. Every row carries `sample: true`, and the UI
// offers a one-click clear.
import { PRESET_VERSION, migratePresets, seedPresets } from './style-presets.js'

const A = name => `media-desk/assets/${name}`

// Platform names 2.x builds stored in Chinese. Written as escapes so this file
// stays ASCII-clean while still matching the values already on disk.
const PLATFORM_ALIASES = {
  '\u516c\u4f17\u53f7': 'WeChat',
  '\u5c0f\u7ea2\u4e66': 'RedNote',
  '\u6296\u97f3': 'Douyin',
  'B\u7ad9': 'Bilibili',
  '\u89c6\u9891\u53f7': 'WeChat Channels',
}

const LEGACY_PRESET_SOURCE = '\u9884\u8bbe'
const LEGACY_SAMPLE_SOURCE = '\u793a\u4f8b'
const LEGACY_SAMPLE_ACCOUNT = '\u793a\u4f8b\u8d26\u53f7'

const SAMPLE_ACCOUNT = 'Sample account'

// Full-width punctuation counts too: a Chinese sentence is full of it.
const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/

const hasCjk = value => value !== undefined && CJK.test(JSON.stringify(value))

const RAW = [
  { k: 'image', img: ['hills', 900, 620], t: 'Why your first AI side project never makes a dollar', b: 'It\'s not the prompts. It\'s not knowing what your first sellable thing should look like. Break that step down in three images.', tags: ['AI', 'Monetization'], a: 'case', p: ['newbie'], st: 'draft', day: 0, src: 'Thought on a walk' },
  { k: 'quote', t: 'Good topics aren\'t dreamed up. They\'re the things you keep complaining about.', b: 'Log a week of complaints. Anything that comes up three times is a topic.', tags: ['Method'], a: 'opinion', p: ['creator'], st: 'idea', day: 0, src: 'Reading notes' },
  { k: 'video', vid: ['v-aurora', 540, 720], t: 'Agents vs. chatbots, explained in 30 seconds', b: 'One waits for you to ask, the other does the work. Open on a task map that flows like an aurora.', tags: ['AI', 'Explainer'], a: 'explain', p: ['newbie'], st: 'outline', day: -1, sch: [2, 20], pf: 'Douyin', src: 'Vertical script' },
  { k: 'web', img: ['topo', 720, 720], t: 'A pricing map for indie developers', b: 'Forty indie pricing pages on one topographic map, so the peaks and valleys jump out.', tags: ['Indie hacking', 'Pricing'], a: 'data', p: ['indie'], st: 'idea', day: -1, url: 'https://example.com/pricing-map', src: 'example.com' },
  { k: 'image', img: ['facade', 720, 940], t: 'Old facades: a design system rewritten by time', b: 'Every window is a patch from whoever came later. A perfect way to talk about tech debt.', tags: ['Design', 'Metaphor'], a: 'analogy', p: ['creator'], st: 'idea', day: -2, src: 'Street photo' },
  { k: 'note', t: 'A 10-minute checklist before you hit publish', b: 'Does the title have a verb? Are the first three seconds plain English? Is the cover readable on a phone? Does the ending ask for just one thing?', tags: ['Workflow'], a: 'list', p: ['creator'], st: 'ready', day: -2, sch: [1, 9], pf: 'RedNote', src: 'My own checklist' },
  { k: 'image', img: ['poster-en', 720, 960], t: 'Slow writing: growing one thought into a long-form post', b: 'A week of not chasing trends: 200 words a day, stitched into one piece on day seven.', tags: ['Writing'], a: 'story', p: ['creator'], st: 'published', day: -18, pub: -9, pf: 'WeChat', src: 'Cover experiment' },
  { k: 'quote', t: 'The best tools end up forgotten.', b: 'A product essay about the things you stop noticing.', tags: ['Product'], a: 'opinion', p: ['indie'], st: 'idea', day: -3, src: 'Quick note' },
  { k: 'video', vid: ['v-tide', 720, 540], t: 'Tidal working: two hours deep, one hour ashore', b: 'Attention as a tide. Open with five seconds of waves and one question.', tags: ['Productivity'], a: 'analogy', p: ['newbie', 'creator'], st: 'draft', day: -3, sch: [4, 12], pf: 'Bilibili', src: 'Storyboard sketch' },
  { k: 'image', img: ['ink', 720, 960], t: 'What landscape painting knows about visual hierarchy', b: 'Sharp foreground, misty distance. Chinese ink painters worked out interface hierarchy centuries ago.', tags: ['Design', 'Culture'], a: 'analogy', p: ['creator'], st: 'outline', day: -4, sch: [6, 20], pf: 'WeChat', src: 'Exhibition notes' },
  { k: 'web', img: ['collage', 780, 620], t: 'Ten charts worth a screenshot', b: 'Collect restrained, beautiful charts and break down what each one chose to leave out.', tags: ['Data', 'Design'], a: 'list', p: ['creator'], st: 'idea', day: -4, url: 'https://example.com/charts', src: 'example.com' },
  { k: 'image', img: ['dunes', 720, 960], t: 'Day 300 of a one-person company: three pivots in the desert', b: 'The revenue curve, the mistakes, and the afternoon I almost quit.', tags: ['Solo business', 'Retrospective'], a: 'story', p: ['indie'], st: 'published', day: -24, pub: -14, pf: 'WeChat', src: 'Retro draft' },
  { k: 'note', t: 'The 5 questions people ask most in the comments', b: '1. Can I do this without a tech background? 2. What does it cost per month? 3. Which model? 4. Is my data safe? 5. How long until I get the hang of it?', tags: ['Audience insight'], a: 'qa', p: ['newbie'], st: 'outline', day: -5, src: 'Comments' },
  { k: 'image', img: ['riso', 720, 860], t: 'Cover color test: why bold stripes get more clicks', b: 'Three A/B rounds. Stripes won on clicks but didn\'t keep people watching any longer.', tags: ['Covers', 'Experiment'], a: 'data', p: ['creator'], st: 'published', day: -30, pub: -21, pf: 'RedNote', src: 'Test log' },
  { k: 'quote', t: 'You don\'t lack ideas. You lack a place to keep them.', b: 'Could be the opening line for Media Desk itself.', tags: ['Method'], a: 'opinion', p: ['creator'], st: 'idea', day: -6, src: 'Quick note' },
  { k: 'video', vid: ['v-bus', 720, 480], t: 'The first product I finished on a night bus', b: 'City lights in the background, told in first person. Mood first, go light on the tech.', tags: ['Story', 'Indie hacking'], a: 'story', p: ['indie', 'newbie'], st: 'published', day: -36, pub: -28, pf: 'Douyin', src: 'Vlog' },
  { k: 'image', img: ['sea', 900, 600], t: 'The nerve to leave space: three products that got better after cutting half their features', b: 'Deleting is a design decision too. Make the case with real examples.', tags: ['Product', 'Design'], a: 'case', p: ['indie', 'creator'], st: 'idea', day: -7, src: 'Product notes' },
  { k: 'web', img: ['stairs', 720, 720], t: 'The growth staircase: the real stages from 0 to 10k followers', b: 'Each step needs different work. Don\'t use a 100k playbook to win your first thousand.', tags: ['Growth'], a: 'data', p: ['creator'], st: 'draft', day: -8, sch: [8, 20], pf: 'WeChat', url: 'https://example.com/steps', src: 'example.com' },
  { k: 'image', img: ['still', 720, 860], t: 'An orange on the desk: an opening about attention', b: 'Stare at an orange for one minute, then ask the viewer: when did you last focus like that?', tags: ['Openings', 'Productivity'], a: 'story', p: ['newbie'], st: 'idea', day: -9, src: 'Quick idea' },
  { k: 'image', img: ['emboss-en', 760, 760], t: 'The feel of type: why embossed letters make you want to touch the screen', b: 'From letterpress to the comeback of skeuomorphism in interfaces.', tags: ['Design', 'Typography'], a: 'explain', p: ['creator'], st: 'idea', day: -10, src: 'Type specimen' },
  { k: 'video', vid: ['v-ink', 600, 600], t: 'Eight seconds of ink: a transition library', b: 'Ink spreading in water works as a chapter transition. Package it as a set.', tags: ['Footage', 'Editing'], a: 'list', p: ['creator'], st: 'idea', day: -11, src: 'Stock clips' },
  { k: 'note', t: 'Just one thing this week', b: 'Cut the path from idea to finished post to under 24 hours, then track how much more you publish in a week.', tags: ['Experiment', 'Workflow'], a: 'story', p: ['creator'], st: 'idea', day: -12, src: 'Weekly plan' },
  { k: 'image', img: ['aurora', 800, 800], t: 'Gradients are back: why every AI product looks the same', b: 'When every product uses the same gradient, where does the difference go?', tags: ['Design', 'AI'], a: 'opinion', p: ['creator', 'indie'], st: 'idea', day: -13, src: 'Trend watch' },
  { k: 'image', img: ['night', 720, 900], t: 'City lights at night: 6 moods for long-form images', b: 'A mood board of images that won\'t look like everyone else\'s.', tags: ['Footage'], a: 'list', p: ['creator'], st: 'idea', day: -15, src: 'Mood board' },
  { k: 'image', img: ['blush', 800, 800], t: 'A letter to the anxious beginner', b: 'No tactics. Just what actually happens in your first year.', tags: ['Beginners', 'Empathy'], a: 'story', p: ['newbie'], st: 'outline', day: -16, src: 'Reader letter' },
]

/** Sample card text by the id buildSeed assigns, used when upgrading old data. */
const SEED_TEXT = Object.fromEntries(RAW.map((row, index) => [`seed_${index + 1}`, {
  title: row.t, body: row.b, tags: row.tags, source: row.src,
}]))

// Two sample images carry printed text, so they were reprinted in English. The
// pairs are derived from the seed rows to keep the file names in one place.
const MEDIA_UPGRADES = Object.fromEntries(RAW
  .filter(row => row.img?.[0].endsWith('-en'))
  .map(row => [`${row.img[0].replace(/-en$/, '')}.jpg`, `${row.img[0]}.jpg`]))

const ANGLES = [
  ['case', 'Real case', 'What one person did, and how it went', 'Start from a specific person and specific numbers, then pull out the method.'],
  ['opinion', 'Contrarian take', 'Everyone says A. It\'s actually B.', 'Lay out the common view, knock it down with evidence, and end on a question worth discussing.'],
  ['explain', '30-second explainer', 'One plain sentence that makes a concept click', 'One analogy, no jargon, so an outsider could explain it back.'],
  ['data', 'Data experiment', 'I tested it N times. Here\'s what happened.', 'Give the sample size, the process and the counterintuitive result, plus a way to reproduce it.'],
  ['analogy', 'Cross-domain analogy', 'This is really the same thing as X', 'Re-explain an old problem with a picture from another field.'],
  ['list', 'Save-worthy list', 'Save this, you\'ll need it', 'Clear structure people can follow as is. Built to be saved and shared.'],
  ['story', 'First-person story', 'The day I almost quit', 'A scene, a turn and real feeling. Keep the tech light.'],
  ['qa', 'Answering comments', 'The questions you ask most', 'Answer real questions directly and put readers\' own words in the title.'],
]

const PEOPLE = [
  ['newbie', 'Lena, curious beginner', 'Target reader', '25 to 32, office job, wants AI to save time or start a side project, but gets scared off by jargon.', ['Jargon-shy', 'Wants a first step', 'Watches short videos'], 0],
  ['creator', 'Alex, fellow creator', 'Target reader', 'A few thousand followers. Cares about topics, covers and workflow, and will pay for a good method.', ['Method nerd', 'Saves everything', 'Checks the numbers'], 1],
  ['indie', 'Sam, indie developer', 'Target reader', 'Can code, but short on growth and pricing experience. Loves honest revenue breakdowns.', ['Wants the real story', 'Hates fluff', 'Long-form reader'], 2],
  ['editor', 'Maya, editing partner', 'Collaborator', 'Handles short-video edits and covers. Free on Tuesdays and Thursdays.', ['Editing', 'Covers'], 3],
]

const SKILLS = [
  ['Lead with a number', 'Put a concrete number or result in the first 50 words. No warm-up.', 'Example: from 3 high-performing posts', 'active', 0.82],
  ['One piece, one point', 'Cut every paragraph that doesn\'t serve the main point. Split it into a series if you have to.', 'Example: you made this edit in 2 drafts', 'active', 0.74],
  ['Use readers\' words in the title', 'Lift exact phrases from the comments into the title. They get more clicks than your own summary.', 'Example: needs more data to confirm', 'proposed', 0.51],
]

const ACCOUNTS = [
  ['WeChat', SAMPLE_ACCOUNT, 12840],
  ['RedNote', SAMPLE_ACCOUNT, 8620],
  ['Douyin', SAMPLE_ACCOUNT, 21300],
  ['Bilibili', SAMPLE_ACCOUNT, 5470],
]

// Built-in text by row id, for upgrading rows that are still Chinese. Same
// values buildSeed writes, so a migrated row matches a fresh install.
const PEOPLE_TEXT = Object.fromEntries(PEOPLE.map(([id, name, role, note, traits]) => [id, { name, role, note, traits }]))
const ANGLE_TEXT = Object.fromEntries(ANGLES.map(([id, name, hook, prompt]) => [id, { name, hook, prompt }]))
const SKILL_TEXT = Object.fromEntries(SKILLS.map(([name, rule, evidence], index) => [`seed_s_${index + 1}`, { name, rule, evidence }]))

// Items, metrics and accounts store the platform as part of a compound key
// ("RedNote:abc123"). Translating the platform field alone would leave the key
// pointing at the old name, so re-imports would no longer match existing rows.
function migrateKey(key) {
  if (typeof key !== 'string') return key
  const at = key.indexOf(':')
  if (at < 0) return key
  const mapped = PLATFORM_ALIASES[key.slice(0, at)]
  return mapped ? `${mapped}${key.slice(at)}` : key
}

function shift(base, days, hour = 10, minute = 0) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** Resolve the compact img/vid tuple into the media object the UI expects. */
function mediaOf(row) {
  return row.img
    ? { src: A(`${row.img[0]}.jpg`), w: row.img[1], h: row.img[2] }
    : row.vid
      ? { src: A(`${row.vid[0]}.mp4`), poster: A(`${row.vid[0]}-poster.jpg`), w: row.vid[1], h: row.vid[2] }
      : null
}

/**
 * Build the sample state around `now`, so the calendar and schedule always land
 * near today's date.
 * @param {Date} now - Reference time.
 * @returns {object} A complete state object.
 */
export function buildSeed(now) {
  const items = RAW.map((row, index) => {
    const id = `seed_${index + 1}`
    const media = mediaOf(row)
    return {
      id,
      kind: row.k,
      title: row.t,
      body: row.b,
      tags: row.tags,
      status: row.st,
      angleId: row.a,
      personaIds: row.p,
      media,
      url: row.url ?? null,
      source: row.src,
      createdAt: shift(now, row.day, 9 + (index % 11), (index * 7) % 60),
      scheduledAt: row.sch ? shift(now, row.sch[0], row.sch[1]) : row.pub !== undefined ? shift(now, row.pub, 20) : null,
      publishedAt: row.pub !== undefined ? shift(now, row.pub, 20) : null,
      platform: row.pf ?? null,
      drafts: {},
      sample: true,
    }
  })

  const metrics = []
  const published = items.filter(item => item.publishedAt)
  // A decaying nine-day view curve per published post. Demo numbers only, there
  // to give the retro screen something to draw.
  const PEAK = { seed_7: 8200, seed_12: 21400, seed_14: 12600, seed_16: 34800 }
  for (const item of published) {
    const start = new Date(item.publishedAt)
    const peak = PEAK[item.id] ?? 6000
    for (let d = 0; d < 9; d += 1) {
      const date = new Date(start)
      date.setDate(date.getDate() + d)
      if (date > now) break
      const views = Math.round(peak * Math.exp(-d * 0.55) * (0.9 + ((d * 37) % 20) / 100))
      metrics.push({
        id: `seed_m_${item.id}_${d}`, itemId: item.id, platform: item.platform, date: date.toISOString(), views,
        likes: Math.round(views * 0.046), comments: Math.round(views * 0.009), shares: Math.round(views * 0.012), saves: Math.round(views * (item.platform === 'RedNote' ? 0.05 : 0.018)), sample: true,
      })
    }
  }

  const state = {
    version: 1,
    sampleCleared: false,
    items,
    people: PEOPLE.map(([id, name, role, note, traits, tone]) => ({ id, name, role, note, traits, tone, sample: true })),
    angles: ANGLES.map(([id, name, hook, prompt]) => ({ id, name, hook, prompt, sample: true })),
    skills: SKILLS.map(([name, rule, evidence, status, confidence], index) => ({ id: `seed_s_${index + 1}`, name, rule, source: 'Sample', evidence, status, confidence, sample: true })),
    accounts: ACCOUNTS.map(([platform, handle, followers], index) => ({ id: `seed_ac_${index + 1}`, platform, handle, followers, url: null, sample: true })),
    metrics,
    styles: seedPresets(),
    presetVersion: PRESET_VERSION,
    activeStyleId: null,
    chat: [],
  }
  return state
}

/**
 * Bring a state written by an older build up to date. Every rule only touches
 * values that are still in their old form, so this can run on every load.
 * @param {object} state - State loaded from disk, edited in place.
 * @returns {object} The same state.
 */
export function migrateState(state) {
  if (state.activeStyleId === undefined) state.activeStyleId = null
  upgradeLegacySamples(state)
  return migratePresets(state)
}

/**
 * 2.x builds wrote the sample content in Chinese. Swap untouched sample cards
 * for the English seed text, and translate the platform and source values that
 * user content shares with it.
 * @param {object} state - State loaded from disk, edited in place.
 */
function upgradeLegacySamples(state) {
  for (const row of state.items ?? []) {
    if (!row) continue
    if (row.platform) row.platform = PLATFORM_ALIASES[row.platform] ?? row.platform
    row.externalId = migrateKey(row.externalId)
    if (row.source === LEGACY_PRESET_SOURCE) row.source = 'Preset'
    else if (row.source === LEGACY_SAMPLE_SOURCE) row.source = 'Sample'
    const seed = row.sample === true ? SEED_TEXT[row.id] : null
    if (seed) {
      // Field by field, so an English edit to one field survives the translation
      // of the others. A sample card the user rewrote entirely is left alone.
      for (const field of ['title', 'body', 'tags', 'source']) {
        if (hasCjk(row[field])) row[field] = structuredClone(seed[field])
      }
      const legacyImage = row.media?.src?.split('/').pop()
      if (legacyImage && MEDIA_UPGRADES[legacyImage]) row.media = { ...row.media, src: A(MEDIA_UPGRADES[legacyImage]) }
      // Model output on a sample card can't be translated field by field, and it
      // is placeholder work, so drop it rather than leave Chinese in the UI.
      if (hasCjk(row.production)) delete row.production
      if (hasCjk(row.drafts)) row.drafts = {}
    }
    delete row.otherLang
  }
  for (const row of state.people ?? []) {
    const text = row?.sample === true ? PEOPLE_TEXT[row.id] : null
    if (!text) continue
    for (const field of ['name', 'role', 'note', 'traits']) {
      if (hasCjk(row[field])) row[field] = structuredClone(text[field])
    }
  }
  for (const row of state.angles ?? []) {
    const text = row?.sample === true ? ANGLE_TEXT[row.id] : null
    if (!text) continue
    for (const field of ['name', 'hook', 'prompt']) {
      if (hasCjk(row[field])) row[field] = structuredClone(text[field])
    }
  }
  for (const row of state.accounts ?? []) {
    if (!row) continue
    if (row.platform) row.platform = PLATFORM_ALIASES[row.platform] ?? row.platform
    row.externalId = migrateKey(row.externalId)
    if (row.sample === true && row.handle === LEGACY_SAMPLE_ACCOUNT) row.handle = SAMPLE_ACCOUNT
  }
  for (const row of state.metrics ?? []) {
    if (row?.platform) row.platform = PLATFORM_ALIASES[row.platform] ?? row.platform
    if (row) row.externalId = migrateKey(row.externalId)
  }
  for (const row of state.skills ?? []) {
    if (!row) continue
    if (row.source === LEGACY_PRESET_SOURCE) row.source = 'Preset'
    else if (row.source === LEGACY_SAMPLE_SOURCE) row.source = 'Sample'
    const text = row.sample === true ? SKILL_TEXT[row.id] : null
    if (text) {
      for (const field of ['name', 'rule', 'evidence']) {
        if (hasCjk(row[field])) row[field] = structuredClone(text[field])
      }
    }
  }
  for (const row of state.styles ?? []) {
    if (row) row.accountKey = migrateKey(row.accountKey)
  }
  delete state.sampleLang
}
