import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Settings } from '../src/settings.js'
import { generateImage } from '../src/images.js'
import { saveProduction } from '../src/export.js'

// A two-frame 1×1 GIF with a loop extension and different frame colors.
const gif = Buffer.from('47494638396101000100800000000000ffffff21ff0b4e45545343415045322e30030100000021f904000a0000002c000000000100010000020244010021f904000a0000002c00000000010001000002024c01003b', 'hex')

test('GPT Image 2.6 requests an animated GIF and keeps its original bytes in the export', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'desk-gif-'))
  try {
    const settings = await new Settings(dir).update({ image: {
      baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-2.6-flare', apiKey: 'fixture',
      outputFormat: 'gif', frameCount: 6, frameDurationMs: 170,
    } })
    const fetchImpl = async (_url, request) => {
      const body = JSON.parse(request.body)
      assert.deepEqual([body.output_format, body.frame_count, body.frame_duration_ms, body.size], ['gif', 6, 170, 'auto'])
      assert.match(body.prompt, /loop/i)
      return Response.json({ data: [{ b64_json: gif.toString('base64') }] })
    }
    const generated = await generateImage(settings.image, 'A small flag waves', { fetchImpl })
    assert.equal(generated.ext, '.gif')
    assert.deepEqual(generated.buffer, gif)
    const filesDir = join(dir, 'files')
    await mkdir(filesDir)
    await writeFile(join(filesDir, 'sample.gif'), generated.buffer)
    const asset = { src: 'media-desk/files/sample.gif' }
    const result = await saveProduction({ title: 'GIF test', cover: asset, images: [asset], shots: [asset] }, { filesDir, exportDir: dir })
    for (const name of ['cover-original.gif', 'figure-1.gif', 'shot-01.gif']) {
      assert.deepEqual(await readFile(join(result.path, name)), gif)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('an image response that ignores GIF output is reported as an error', async () => {
  const image = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-2.6-sunburst', apiKey: 'fixture', outputFormat: 'gif' }
  await assert.rejects(generateImage(image, 'A flag', {
    fetchImpl: async () => Response.json({ data: [{ b64_json: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]).toString('base64') }] }),
  }), /did not return an animated GIF/)
})
