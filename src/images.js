// Open image generation: any service compatible with the OpenAI Images API works; the user supplies the endpoint, model and key.
import { assertPublicUrl } from './harvest.js'
import { tr } from './i18n.js'

const TIMEOUT_MS = 300_000
const MAX_IMAGE_BYTES = 40_000_000

function extensionOf(buffer) {
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50) return '.png'
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8) return '.jpg'
  if (buffer.length > 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return '.webp'
  if (buffer.length > 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('latin1', 0, 6))) return '.gif'
  return null
}

function redact(text, key) {
  const clean = String(text ?? '').slice(0, 300)
  return key ? clean.split(key).join('***') : clean
}

function explain(status, detail) {
  if (status === 401 || status === 403) return tr('The key is invalid or can\'t use this model ({status})', { status })
  if (status === 404) return tr('Wrong endpoint or model (404)')
  if (status === 429) return tr('Too many requests or out of quota (429)')
  return detail ? tr('The image service returned {status}: {detail}', { status, detail }) : tr('The image service returned {status}', { status })
}

async function requestOnce(image, prompt, fetchImpl, signal) {
  const extra = image.extra ? JSON.parse(image.extra) : {}
  const body = { model: image.model, prompt, n: 1, ...(image.size ? { size: image.size } : {}), ...(image.quality ? { quality: image.quality } : {}), ...extra }
  if (image.outputFormat === 'gif') {
    Object.assign(body, {
      prompt: `${body.prompt} Animate a small, natural motion in a seamless loop, keeping the subject and framing consistent.`,
      output_format: 'gif',
      frame_count: image.frameCount ?? 9,
      frame_duration_ms: image.frameDurationMs ?? 200,
      size: 'auto',
      n: 1,
    })
    delete body.output_compression
    delete body.partial_images
    delete body.stream
  }
  const res = await fetchImpl(`${image.baseUrl}/images/generations`, {
    method: 'POST',
    headers: { authorization: `Bearer ${image.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const raw = await res.text()
  let data = null
  try {
    data = JSON.parse(raw)
  } catch {
    // Gateways sometimes return an HTML error page
  }
  if (!res.ok) {
    const error = new Error(explain(res.status, redact(data?.error?.message ?? data?.message ?? '', image.apiKey)))
    error.retryable = res.status >= 500
    throw error
  }
  // OpenAI-style services put the result in data[0]; some others use images[0]
  const entry = data?.data?.[0] ?? data?.images?.[0]
  if (entry?.b64_json) return { buffer: Buffer.from(entry.b64_json, 'base64'), revisedPrompt: entry.revised_prompt }
  if (entry?.url) {
    const url = await assertPublicUrl(entry.url)
    const download = await fetchImpl(url, { signal })
    if (!download.ok) throw new Error(tr('Couldn\'t download the image ({status})', { status: download.status }))
    return { buffer: Buffer.from(await download.arrayBuffer()), revisedPrompt: entry.revised_prompt }
  }
  const error = new Error(tr('The image service didn\'t return an image'))
  error.retryable = !data
  throw error
}

/**
 * Generate one image. Retries once when the gateway hiccups.
 * @param {object} image - Image settings.
 * @param {string} prompt - The prompt.
 * @param {{fetchImpl?: typeof fetch, signal?: AbortSignal}} [options]
 * @returns {Promise<{buffer: Buffer, ext: string}>} Image bytes and extension.
 */
export async function generateImage(image, prompt, { fetchImpl = fetch, signal } = {}) {
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const timeout = AbortSignal.timeout(TIMEOUT_MS)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
    try {
      const { buffer } = await requestOnce(image, prompt, fetchImpl, combined)
      if (buffer.length > MAX_IMAGE_BYTES) throw new Error(tr('The image is too large'))
      const ext = extensionOf(buffer)
      if (image.outputFormat === 'gif' && ext !== '.gif') throw new Error(tr('The image service did not return an animated GIF'))
      if (!ext) throw new Error(tr('What came back isn\'t an image'))
      return { buffer, ext }
    } catch (err) {
      if (signal?.aborted) throw err
      lastError = err
      const network = err.name === 'TypeError' || err.name === 'TimeoutError'
      if (!err.retryable && !network) break
    }
  }
  const message = lastError.name === 'TimeoutError' ? tr('Image generation timed out. You can retry.') : lastError.name === 'TypeError' ? tr('Can\'t reach the image service: {reason}', { reason: redact(lastError.cause?.code ?? lastError.message, image.apiKey) }) : redact(lastError.message, image.apiKey)
  throw new Error(message)
}

const COVER_STYLE = 'Editorial cover image, striking composition with calm negative space in the lower third, refined and cinematic, no text, no letters, no logo.'
const FIGURE_STYLE = 'Editorial article illustration, refined and consistent with a modern magazine, no text, no letters, no logo.'
const SHOT_STYLE = 'Film storyboard panel, black and white pencil line art sketch, loose confident lines, no color, plain white paper background, no text, no letters, no captions, no panel numbers.'

export function coverPrompt(prompt) {
  return `${COVER_STYLE} ${prompt}`
}

export function figurePrompt(prompt) {
  return `${FIGURE_STYLE} ${prompt}`
}

export function shotPrompt(prompt, characters) {
  return `${SHOT_STYLE} Widescreen 16:9 landscape framing, the scene fills the whole frame edge to edge, no borders. ${characters ? `Recurring characters and setting: ${characters}. ` : ''}${prompt}`
}
