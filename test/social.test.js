import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchInstagram, parsePublicX } from '../src/social.js'
import { Connections, REFRESH_MS } from '../src/connections.js'

test('public X parses data without executing scripts and keeps only profile authors', () => {
  const tweet = (id, handle) => ({
    __typename: 'Tweet', rest_id: id, core: { user_results: { result: { core: { screen_name: handle } } } },
    tweet: { full_text: 'A post from the fixture', created_at_ms: 1790000000000 },
  })
  const data = { timeline: { instructions: [{ __typename: 'TimelineAddEntries', entries: [
    { content: { itemContent: { tweet_results: { result: tweet('1234567890', 'Example') } } } },
    { content: { itemContent: { tweet_results: { result: tweet('2234567890', 'Other') } } } },
  ] }] } }
  const posts = parsePublicX(`<script>throw Error('must not execute'); receive(${JSON.stringify(JSON.stringify(data))})</script>`, 'example')
  assert.deepEqual(posts.map(x => [x.id, x.url, x.author]), [['1234567890', 'https://x.com/example/status/1234567890', 'Example']])
  assert.deepEqual(parsePublicX('<title>Log in</title>', 'example'), [])
})

test('Meta verifies the account before fetching media and keeps token out of URLs', async () => {
  const account = { id: 'brand' }
  const token = 'fixture-token'
  const seen = []
  const fake = async (url, options) => {
    seen.push(url)
    assert.equal(options.redirect, 'error')
    assert.equal(options.headers.authorization, 'Bearer ' + token)
    assert.ok(!url.includes(token))
    return Response.json(seen.length === 1 ? { id: '10', username: 'Brand' } : { data: [
      { id: '20', permalink: 'https://www.instagram.com/p/Abc123/', caption: 'A caption', timestamp: '2026-10-01T00:00:00Z' },
      { id: '21', permalink: 'https://example.com/p/Abc123/', timestamp: '2026-10-01T00:00:00Z' },
    ] })
  }
  assert.deepEqual((await fetchInstagram(account, token, fake)).posts.map(x => x.id), ['Abc123'])
  await assert.rejects(fetchInstagram(account, token, async () => Response.json({ id: '99', username: 'other' })), /different Instagram account/)
})

test('connections persist and retry every eight hours without exposing tokens', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'desk-links-'))
  try {
    const store = new Connections(dir)
    await store.save({ platform: 'Instagram', id: 'brand', url: 'https://www.instagram.com/brand/', token: 'secret' })
    const [row] = await new Connections(dir).list()
    assert.equal(row.token, undefined)
    assert.equal(row.authorized, true)
    assert.equal((await store.due(0)).length, 1)
    await store.record(row.key, { at: 100, error: 'rate limited' })
    assert.equal((await store.due(100 + REFRESH_MS - 1)).length, 0)
    assert.equal((await store.due(100 + REFRESH_MS)).length, 1)
    await store.record(row.key, { at: 200, error: null })
    const [saved] = await store.list()
    assert.equal(saved.lastSuccessAt, 200)
    assert.equal(saved.error, null)
    await store.remove(row.key)
    assert.deepEqual(await store.list(), [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('switching image providers clears the previous endpoint key and accepts GPT Image 2.6', async () => {
  const { Settings, publicSettings } = await import('../src/settings.js')
  const { generateImage } = await import('../src/images.js')
  const dir = await mkdtemp(join(tmpdir(), 'desk-image-'))
  try {
    const settings = new Settings(dir)
    await settings.update({ image: { baseUrl: 'https://old.example/v1', apiKey: 'old-key' } })
    const updated = await settings.update({ image: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-2.6-sunburst' } })
    assert.equal(updated.image.apiKey, '')
    const configured = await settings.update({ image: { apiKey: 'fixture-key' } })
    assert.equal(publicSettings(configured).image.apiKey, undefined)
    const image = await generateImage(configured.image, 'A cover', { fetchImpl: async (url, request) => {
      assert.equal(url, 'https://api.openai.com/v1/images/generations')
      assert.equal(JSON.parse(request.body).model, 'gpt-image-2.6-sunburst')
      assert.equal(request.headers.authorization, 'Bearer fixture-key')
      return Response.json({ data: [{ b64_json: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]).toString('base64') }] })
    } })
    assert.equal(image.ext, '.jpg')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
