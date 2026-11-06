// Style presets, grouped by the kind of creator they fit. Users can edit any of
// them, or harvest their own account to generate a personal one.
export const STYLE_CATEGORIES = ['Tech', 'Travel & food', 'Lifestyle', 'Opinion', 'Tutorials', 'Reviews', 'Stories', 'News']

export const STYLE_PRESETS = [
  {
    id: 'ai_tech', category: 'Tech', icon: '🤖', name: 'AI tech creator', summary: 'Turns complex tech into one analogy you can follow, then tells you why it matters to you.',
    tone: 'Curious and clear-headed. Excited without the hype, and says so when a claim is unverified.', sentences: 'Mostly short sentences. Conclusion first, then the why. Every technical term is followed by a plain-English line.',
    opening: 'Open on something that just changed and say within three seconds why it\'s worth watching.', structure: 'What happened → the idea, through an analogy → what I saw when I tried it → what it means for regular people.',
    words: ['Put simply', 'I tried it', 'The key is', 'Which means'], avoid: ['game-changer', 'mind-blowing', 'insane', 'conclusions without testing'],
    samples: ['Put simply, it didn\'t get smarter. It finally remembers what you said a minute ago.', 'I tried it. The first ten minutes were impressive. By minute eleven it was making things up.'],
    source: 'Preset',
  },
  {
    id: 'gadget', category: 'Tech', icon: '📱', name: 'Gadget reviewer', summary: 'No spec-sheet reading. Just what\'s great and what makes you want a refund after two weeks.',
    tone: 'Practical and a little picky, on the side of people spending their own money.', sentences: 'Numbers and experience come in pairs. Lots of comparisons, few adjectives.',
    opening: 'Lead with the verdict: who should buy it and who should not.', structure: 'One-line verdict → the best thing → the most annoying thing → versus last year or the competition → buying advice.',
    words: ['In my testing', 'battery life', 'worth it?', 'who should buy', 'who should skip'], avoid: ['flagship experience', 'punches above its weight', 'copying the marketing'],
    samples: ['In my testing it needed two charges a day. The thirty hours on the box only exist on the box.', 'If the one you have still works, you can skip this year.'],
    source: 'Preset',
  },
  {
    id: 'travel', category: 'Travel & food', icon: '✈️', name: 'Travel creator', summary: 'Not a checklist. It puts you in the place, then hands you the details that actually help.',
    tone: 'Relaxed and visual, honest about what went wrong.', sentences: 'Mix long and short. Write what you saw, heard and smelled, and make the practical details specific.',
    opening: 'Open on one specific moment, like the harbor at six in the morning.', structure: 'One moment → why I came → three places truly worth it → what went wrong → time and cost.',
    words: ['That day', 'locals', 'per person', 'book ahead', 'skip'], avoid: ['paradise on earth', 'once in a lifetime', 'hidden gem'],
    samples: ['At six that morning the harbor had no tourists, just fish being unloaded and a bowl of noodles too hot to eat.', 'About $15 a person, but skip the place by the entrance. Locals all head down the alley.'],
    source: 'Preset',
  },
  {
    id: 'food', category: 'Travel & food', icon: '🍜', name: 'Food reviewer', summary: 'What the first bite is like, whether it\'s worth the price and how long the line is, all spelled out.',
    tone: 'Hungry and honest. Praises what is good and says when it isn\'t.', sentences: 'Specific texture words, short punchy lines, and always the price and location.',
    opening: 'Open on the bite you want most.', structure: 'The signature bite → where, how much, how long the wait → must-order and skip → a one-line verdict.',
    words: ['this bite', 'per person', 'the line', 'skip it', 'would go back'], avoid: ['to die for', 'literally crying', 'praise without a verdict'],
    samples: ['The first bite is crackly, and the richness only comes through after.', 'About $8 a person and a forty-minute line. The food is worth it, the wait isn\'t. Go after two.'],
    source: 'Preset',
  },
  {
    id: 'vlog', category: 'Lifestyle', icon: '🎬', name: 'Daily vlogger', summary: 'Like a friend carrying a camera through the day. Small, funny moments and a quiet feeling at the end.',
    tone: 'Warm and natural, happy to laugh at yourself, never stiff.', sentences: 'Conversational, like talking while walking. Lots of "then" and "turns out". Pauses are fine.',
    opening: 'Open with a small thing or a small surprise from today.', structure: 'Today\'s small surprise → the day in order → one small turn in the middle → one honest feeling at the end.',
    words: ['today', 'then', 'turns out', 'didn\'t expect', 'it was nice'], avoid: ['hey guys', 'lecturing', 'forced life lessons'],
    samples: ['I only went downstairs to grab a package. Turns out I sat out there for an hour.', 'Nothing big happened, but it was a nice day.'],
    source: 'Preset',
  },
  {
    id: 'home', category: 'Lifestyle', icon: '🏡', name: 'Solo living creator', summary: 'Makes ordinary rooms and days feel comfortable, and tells you honestly what it cost.',
    tone: 'Quiet and gentle, with an unhurried, lived-in feel.', sentences: 'Short, light sentences about light, sound and habits. Hardly any exclamation marks.',
    opening: 'Open on a daily habit, like opening the window every morning.', structure: 'A daily habit → a small change to a space or object → what it cost and how → how it feels.',
    words: ['slowly', 'the light', 'while I\'m at it', 'cost me', 'just right'], avoid: ['aesthetic lifestyle', 'self-care ritual', 'selling insecurity'],
    samples: ['At four in the afternoon the light lands right on this table.', 'This table cost $40. Not much, but it got me eating at home again.'],
    source: 'Preset',
  },
  {
    id: 'reading', category: 'Opinion', icon: '📚', name: 'Book notes creator', summary: 'Not a summary of the book. One idea that changed your mind, turned into one thing you can do.',
    tone: 'Calm and sincere, about how a book won you over.', sentences: 'Start with a real-life problem, quote one line, then explain in short sentences.',
    opening: 'Open with a specific problem, then bring in the book.', structure: 'A problem I had → one idea from the book → an example → one thing to try today.',
    words: ['this book', 'that\'s when I realized', 'in other words', 'try this'], avoid: ['this book will change your life', 'packed with value', 'reciting the table of contents'],
    samples: ['On this page I realized I wasn\'t short on time. I just refused to give anything up.', 'In other words, decide what not to do first. You can try it today.'],
    source: 'Preset',
  },
  {
    id: 'career', category: 'Opinion', icon: '💼', name: 'Career creator', summary: 'Opinion first. One real story that nails a lesson about work and says what everyone thinks but nobody says.',
    tone: 'Direct and clear-eyed, a little sharp but never mean.', sentences: 'Short declarative lines, rhetorical questions and contrasts, examples down to the exact scene.',
    opening: 'Open by rejecting something everyone believes.', structure: 'A counterintuitive take → a scene I lived through → the logic behind it → one action you can copy.',
    words: ['Stop', 'The truth is', 'I\'ve seen', 'next meeting'], avoid: ['grind harder', 'fear-mongering', 'empty motivation'],
    samples: ['Stop saying you\'re bad at managing up. You\'ve been waiting for someone to notice you first.', 'The truth is, anything nobody claims before the meeting ends isn\'t getting done.'],
    source: 'Preset',
  },
  {
    id: 'tutorial', category: 'Tutorials', icon: '🛠️', name: 'How-to creator', summary: 'Shows you the result first, then walks you through step by step, with where each step tends to go wrong.',
    tone: 'Patient and efficient, like a friend sitting next to you.', sentences: 'Short sentences that start with a verb. Clear steps, one thing per step.',
    opening: 'Show the finished result and the time it saves.', structure: 'End result → what you need → step by step → the easiest mistake → what to try next.',
    words: ['Step one', 'click here', 'careful', 'once you\'re done', 'saves'], avoid: ['it\'s easy', 'everyone knows this', 'skipping steps'],
    samples: ['Here\'s the result. What used to take two hours now takes three minutes.', 'Careful, don\'t click OK yet. Check the format in the top right first. That\'s where nine out of ten mistakes happen.'],
    source: 'Preset',
  },
  {
    id: 'business', category: 'Tutorials', icon: '📈', name: 'Business explainer', summary: 'Starts from something odd, then works out where the money comes from, whether the math works and what you can learn.',
    tone: 'Calm and certain. Lets the numbers talk, no drama.', sentences: 'Short sentences, one idea each, lots of numbers and comparisons, and guesses labeled as guesses.',
    opening: 'Open with a strange number or fact.', structure: 'Something odd → how it makes money → run the numbers → where the risk is → what regular people can learn.',
    words: ['run the numbers', 'gross margin', 'in the end', 'the lesson is'], avoid: ['the next big thing', 'secret to wealth', 'guaranteed returns', 'investment advice'],
    samples: ['A $1.50 coffee and ten thousand stores. Let\'s run the numbers.', 'In the end it isn\'t making money on coffee. It\'s making money by spreading the rent thin.'],
    source: 'Preset',
  },
  {
    id: 'beauty', category: 'Reviews', icon: '💄', name: 'Beauty and skincare creator', summary: 'Says which skin types it suits, how long it takes to work and whether there is a cheaper dupe.',
    tone: 'Friendly and honest, like a friend telling you the truth.', sentences: 'Specific about feel and results, lots of "works for" and "not for", and every recommendation backed up.',
    opening: 'Open with a specific skin problem or a product that went wrong.', structure: 'My skin type and problem → what I used and for how long → real results → who should skip it → a dupe.',
    words: ['skin type', 'on the skin', 'after two weeks', 'not for', 'dupe'], avoid: ['miracle fix', 'overnight results', 'medical claims'],
    samples: ['Combination oily skin, two weeks in: less afternoon shine, but the bumps are unchanged.', 'Sensitive skin, hold off. Alcohol is high on the list and it stings a little.'],
    source: 'Preset',
  },
  {
    id: 'outfit', category: 'Reviews', icon: '👗', name: 'Fashion creator', summary: 'Not just "looks good": who it suits, how to style it and how many seasons you get out of it.',
    tone: 'Light and opinionated, with clear taste and no talking down.', sentences: 'Short sentences, height and size spelled out, styling down to specific pieces.',
    opening: 'Open with an occasion or a common fit problem.', structure: 'Occasion or problem → how this outfit comes together → why the proportions work → size and price → another way to wear it.',
    words: ['proportions', 'on me', 'for work', 'wear it many ways', 'swap in'], avoid: ['look ten pounds thinner', 'body shaming', 'must-buy'],
    samples: ['I\'m 5\'4" in a medium. Raising the waistline an inch fixes the proportions right away.', 'This works for the office, and with jeans on the weekend it still fits.'],
    source: 'Preset',
  },
  {
    id: 'story', category: 'Stories', icon: '🌙', name: 'Personal story creator', summary: 'Like a late-night talk with a friend, going from one small moment to something you finally understood.',
    tone: 'Relaxed and honest, willing to share the embarrassing parts, slow to judge.', sentences: 'Long and short lines mixed, natural pauses, lots of detail, few conclusions.',
    opening: 'Open on a specific time and place.', structure: 'A scene → what happened → what I didn\'t get at the time → the one line that made sense later.',
    words: ['That night', 'only later did I realize', 'actually', 'honestly'], avoid: ['if you know you know', 'life-coach voice', 'putting anyone down'],
    samples: ['At eleven that night we sat in the car and neither of us spoke first.', 'Only later did I realize she didn\'t want an answer. She wanted someone to hear her out.'],
    source: 'Preset',
  },
  {
    id: 'parent', category: 'Stories', icon: '🧸', name: 'Parenting creator', summary: 'Captures one thing a kid said and one small moment, then what the parent learned.',
    tone: 'Gentle and funny, not anxious, and never the one right answer.', sentences: 'Conversational short sentences. Keep the kid\'s own words, and make methods specific enough to try.',
    opening: 'Open with something your kid said.', structure: 'What the kid said → how I reacted → what I looked up or tried → what changed after.',
    words: ['Today he said', 'at the time I', 'I tried', 'may not work for every kid'], avoid: ['don\'t let your kid fall behind', 'the right way to parent', 'medical diagnoses'],
    samples: ['Today he said, "When you\'re angry your voice gets quiet, and that scares me more."', 'I tried crouching down before I talk. It may not work for every kid, but it works in our house.'],
    source: 'Preset',
  },
  {
    id: 'news', category: 'News', icon: '📰', name: 'News commentary creator', summary: 'Explains what happened in a minute, separates fact from opinion, then adds an angle nobody mentioned.',
    tone: 'Crisp and neutral, with a view but no agenda.', sentences: 'Short, fast lines. Dates and sources are explicit, and facts and opinions are kept apart.',
    opening: 'Say what happened in the first sentence.', structure: 'What happened → what is confirmed and what isn\'t → why people are arguing → my angle.',
    words: ['What we know so far', 'still unclear', 'source', 'my take'], avoid: ['shocking', 'you won\'t believe', 'rumors as facts'],
    samples: ['Only two things are confirmed so far. Everything else is still rumor.', 'Everyone is arguing about who is right. My take: read clause three of the contract first.'],
    source: 'Preset',
  },
]

const DATE = new Date(2026, 0, 1).toISOString()

export function seedPresets() {
  return STYLE_PRESETS.map(row => ({ ...row, id: `preset_${row.id}`, preset: true, createdAt: DATE }))
}

/** Old three templates map to the presets that replaced them, active style included. */
const OLD_TEMPLATES = { seed_style_calm: 'preset_business', seed_style_story: 'preset_story', seed_style_sharp: 'preset_career' }

// Category names 2.x builds stored. Written as escapes so this file stays plain
// ASCII and a CJK sweep of the source comes back empty.
const CATEGORY_ALIASES = {
  '\u79d1\u6280\u6570\u7801': 'Tech',
  '\u65c5\u884c\u63a2\u5e97': 'Travel & food',
  'Vlog \u751f\u6d3b': 'Lifestyle',
  '\u89c2\u70b9\u8ba4\u77e5': 'Opinion',
  '\u5e72\u8d27\u6559\u7a0b': 'Tutorials',
  '\u79cd\u8349\u6d4b\u8bc4': 'Reviews',
  '\u60c5\u611f\u6545\u4e8b': 'Stories',
  '\u70ed\u70b9\u8d44\u8baf': 'News',
}

const TEXT_FIELDS = ['name', 'summary', 'tone', 'sentences', 'opening', 'structure', 'words', 'avoid', 'samples']

// Full-width punctuation counts too: a preset written in Chinese is full of it.
const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/

export const PRESET_VERSION = 2

const hasCjk = value => value !== undefined && CJK.test(JSON.stringify(value))

function mapCategory(category) {
  return CATEGORY_ALIASES[category] ?? category
}

/**
 * Bring preset rows in line with the English presets: map old category names,
 * and replace the text of a row that is still Chinese. A preset the user edited
 * in English keeps the edit, so this is safe to run on every load.
 * @param {object[]|undefined} styles - rows of state.styles, edited in place.
 */
function normalizePresets(styles) {
  for (const row of styles ?? []) {
    if (!row) continue
    row.category = mapCategory(row.category)
    if (!row.preset) continue
    if (!TEXT_FIELDS.some(field => hasCjk(row[field]))) continue
    const preset = STYLE_PRESETS.find(entry => entry.id === String(row.id).replace(/^preset_/, ''))
    if (!preset) continue
    for (const field of TEXT_FIELDS) row[field] = structuredClone(preset[field])
    row.source = 'Preset'
  }
}

export function migratePresets(state) {
  normalizePresets(state.styles)
  if (state.presetVersion >= PRESET_VERSION) return state
  const kept = (state.styles ?? []).filter(row => !(row.id in OLD_TEMPLATES))
  const known = new Set(kept.map(row => row.id))
  state.styles = [...kept, ...seedPresets().filter(row => !known.has(row.id))]
  if (state.activeStyleId in OLD_TEMPLATES) state.activeStyleId = OLD_TEMPLATES[state.activeStyleId]
  state.presetVersion = PRESET_VERSION
  return state
}
