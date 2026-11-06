// Local mock model (OpenAI-compatible streaming API) for checking the model path in
// development. Uses no real quota.
// It also mocks the image API: it returns sample images from assets/ and waits a few
// seconds on purpose, so you can watch the generation happen.
// Usage: node scripts/mock-llm.mjs [port]. A summary of each request goes to stdout.
import { readFileSync, readdirSync } from 'node:fs'
import { createServer } from 'node:http'

const PORT = Number(process.argv[2] ?? 4399)
const ASSETS = new URL('../assets/', import.meta.url)
const PHOTOS = readdirSync(ASSETS).filter(name => /^(hills|dunes|sea|still|night|ink)\.jpg$/.test(name))
const SKETCHES = readdirSync(ASSETS).filter(name => /^(topo|stairs|facade)\.jpg$/.test(name))
let served = 0

function answer(system, user) {
  if (system.includes('You are a style analyst.')) {
    return JSON.stringify({ name: 'Half a Beat Behind', summary: 'Sets the scene before drawing a conclusion.', tone: 'Calm and curious.', sentences: 'Alternates long and short, often split by commas.', opening: 'Opens on one specific morning.', structure: 'Scene, a question, one small discovery.', words: ['that day', 'later on'], avoid: ['exclamation marks'], samples: ['That morning I was almost late, and still stopped in front of a billboard.'] })
  }
  if (system.includes('You are the content editor, art director and storyboard artist.')) {
    return JSON.stringify({ title: 'Slow still counts as arriving', coverText: 'Slow still counts', facts: ['3 minutes from being late'], outline: ['The morning platform', 'The ending'], cover: 'A lone commuter on an empty subway platform at dawn, soft golden light', characters: 'a young man in a grey jacket with a canvas backpack', images: [{ anchor: 'The morning platform', caption: 'Morning on the platform', prompt: 'Morning light on a subway platform, one figure waiting' }, { anchor: 'The ending', caption: 'The moment he looks up', prompt: 'A person looks up at a billboard with quiet wonder' }], shots: [['Close-up', 'One line on the billboard', 'Slow still counts as arriving.', 'Close-up of a blank billboard corner'], ['Medium', 'He stops and looks up', 'That morning I was almost late.', 'Medium shot from behind, man stops and looks up'], ['Wide', 'The crowd flows past him', 'Everyone is rushing.', 'Wide shot, crowd rushing past a still man'], ['Close', 'He smiles a little', 'I stopped hurrying.', 'Close shot of the man smiling faintly'], ['Overhead', 'Commuters on the platform', 'You only see the way when you slow down.', 'Top-down view of commuters on a platform'], ['Medium', 'He climbs the stairs into sunlight', 'Did you slow down today?', 'Medium shot, man climbing stairs into sunlight']].map(([shot, visual, voice, prompt]) => ({ shot, visual, voice, seconds: 5, prompt })) })
  }
  if (system.includes('Output only one JSON object')) {
    const said = user.slice(user.lastIndexOf('The user says: ') + 'The user says: '.length)
    const focus = /focusId: (\S+)/.exec(user)?.[1]
    if (user.includes('<production>')) {
      return JSON.stringify({ reply: 'Shortened the title, reworded the first point, and reshot frame 3 from overhead.', ops: [], revise: { title: 'Slow still gets you there', edits: [{ find: 'Point one', replace: 'First point: stop and look' }], shots: [{ no: 3, shot: 'Overhead', voice: 'Everyone is rushing; only he stops.', prompt: 'Top-down view of a crowd flowing around one still man' }] } })
    }
    // "troubleshoot" only exists to make the mock return broken JSON on purpose.
    if (/troubleshoot/i.test(said)) return 'This is not JSON'
    // Mirrors the drafting rule in src/intents.js: write|turn|make|produce|draft plus script|article|post|storyboard.
    if (/\b(?:write|turn|make|produce|draft)\b.*\b(?:script|article|post|storyboard)\b/i.test(said) && focus !== 'null') {
      return JSON.stringify({ reply: 'Starting on the script.', ops: [], actions: [{ type: 'draft', id: focus, format: 'script' }] })
    }
    return JSON.stringify({
      reply: 'Filled it out into a topic and put it on the idea wall.',
      ops: [
        { op: 'add_item', kind: 'note', title: `Filled-out topic: ${said.slice(0, 16)}`, body: 'Notes the model filled in.', tags: ['mock'], status: 'idea' },
        { op: 'add_skill', name: 'Mock rule', rule: 'Keep titles under 20 words', source: 'Chat', status: 'proposed', confidence: 0.6 },
        { op: 'delete_item', id: 'not-a-real-id' },
      ],
    })
  }
  return '# A title the mock wrote\n\nThat morning I was almost late. Three minutes to the train, and I stopped in front of a billboard.\n\n## The morning platform\n\nThere was one line on the billboard. This body text streams in to test the typing effect; the real model writes the final copy.\n\n- Point one\n- Point two\n\n<script>window.__xss = 1</script>\n\n## The ending\n\nLeave one action: slow down once today.\n'
}

createServer((req, res) => {
  const chunks = []
  req.on('data', c => chunks.push(c))
  req.on('end', async () => {
    if (req.url.endsWith('/models')) {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }))
      return
    }
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
    if (req.url.endsWith('/images/generations')) {
      served += 1
      const pool = body.prompt.includes('storyboard') ? SKETCHES : PHOTOS
      await new Promise(r => setTimeout(r, 2500 + (served % 5) * 1500))
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ data: [{ b64_json: readFileSync(new URL(pool[served % pool.length], ASSETS)).toString('base64') }] }))
      return
    }
    const messages = body.messages ?? []
    const flat = m => (typeof m.content === 'string' ? m.content : (m.content ?? []).map(p => p.text ?? '').join(''))
    const system = messages.filter(m => m.role === 'system' || m.role === 'developer').map(flat).join('\n')
    const user = messages.filter(m => m.role === 'user').map(flat).join('\n')
    const text = answer(system, user)
    console.log(JSON.stringify({ url: req.url, model: body.model, stream: body.stream, systemHead: system.slice(0, 30), hasRules: system.includes('Lead with a number'), hasVoice: system.includes('<voice>') }))
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    const base = { id: 'mock', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: body.model }
    const send = choice => res.write(`data: ${JSON.stringify({ ...base, choices: [choice] })}\n\n`)
    send({ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null })
    for (let i = 0; i < text.length; i += 12) {
      send({ index: 0, delta: { content: text.slice(i, i + 12) }, finish_reason: null })
      await new Promise(r => setTimeout(r, 70))
    }
    send({ index: 0, delta: {}, finish_reason: 'stop' })
    res.write(`data: ${JSON.stringify({ ...base, choices: [], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  })
}).listen(PORT, '127.0.0.1', () => console.log(`mock llm on ${PORT}`))
