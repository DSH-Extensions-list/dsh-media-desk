// Composite the video cover: big text over the frame, or a gradient type-only cover when there's no frame.
import { t } from './i18n.js'

const WIDTH = 1920
const HEIGHT = 1080
const MARGIN = 100
const MAX_LINES = 3
const MAX_SIZE = 148
const MIN_SIZE = 64
const REFERENCE_SIZE = 100
// English editorial serif: Georgia ships with macOS and Windows, Liberation Serif with common Linux desktops.
const SERIF = 'Georgia, "Times New Roman", "Liberation Serif", serif'

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(t('Couldn’t load the cover image')))
    image.src = src
  })
}

// Tokenise into words, whitespace and single characters, so an over-long word can split by letter
function wrap(ctx, text, maxWidth, maxLines) {
  const lines = []
  let line = ''
  const tokens = text.match(/[\u0021-\u024f]+\s*|\s+|[^\s]/gu) ?? []
  for (const token of tokens) {
    if (ctx.measureText((line + token).trimEnd()).width <= maxWidth || !line.trim()) {
      line += token
      continue
    }
    lines.push(line.trimEnd())
    line = token.trimStart()
  }
  if (line.trim()) lines.push(line.trimEnd())
  const out = []
  for (const row of lines) {
    if (ctx.measureText(row).width <= maxWidth) {
      out.push(row)
      continue
    }
    let part = ''
    for (const ch of row) {
      if (ctx.measureText(part + ch).width > maxWidth && part) {
        out.push(part)
        part = ch
      } else {
        part += ch
      }
    }
    if (part) out.push(part)
  }
  return out.slice(0, maxLines)
}

/**
 * Pick the display size for an English cover line. The width is measured once at
 * a reference size and scaled to the text area, then confirmed with a real wrap,
 * so a ragged word break cannot push the line past the three-row cap.
 * @param {CanvasRenderingContext2D} ctx - A context with a 2D font.
 * @param {string} text - The cover line.
 * @returns {number} Font size in pixels.
 */
function fitSize(ctx, text) {
  const available = WIDTH - MARGIN * 2
  ctx.font = `700 ${REFERENCE_SIZE}px ${SERIF}`
  const referenceWidth = Math.max(ctx.measureText(text).width, 1)
  // Three rows of the text area, scaled from the reference measurement.
  let size = Math.round((MAX_LINES * available * REFERENCE_SIZE) / referenceWidth)
  size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, size))
  // Word breaks leave a ragged right edge, so step down until a real wrap fits.
  for (;;) {
    ctx.font = `700 ${size}px ${SERIF}`
    if (size === MIN_SIZE || wrap(ctx, text, available, MAX_LINES + 1).length <= MAX_LINES) return size
    size = Math.max(MIN_SIZE, Math.round(size * 0.94))
  }
}

function drawBackground(ctx) {
  const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  base.addColorStop(0, '#1a1b3a')
  base.addColorStop(0.55, '#4a2f6b')
  base.addColorStop(1, '#d9745a')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  const glow = ctx.createRadialGradient(WIDTH * 0.8, HEIGHT * 0.15, 0, WIDTH * 0.8, HEIGHT * 0.15, WIDTH * 0.6)
  glow.addColorStop(0, 'rgba(255, 196, 150, .55)')
  glow.addColorStop(1, 'rgba(255, 196, 150, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
}

/**
 * @param {{src?: string, text: string}} options - Cover image source and the cover line.
 * @returns {Promise<HTMLCanvasElement>} A 1920×1080 cover.
 */
export async function composeCover({ src, text }) {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  drawBackground(ctx)
  if (src) {
    const image = await loadImage(src)
    const scale = Math.max(WIDTH / image.width, HEIGHT / image.height)
    ctx.drawImage(image, (WIDTH - image.width * scale) / 2, (HEIGHT - image.height * scale) / 2, image.width * scale, image.height * scale)
    const shade = ctx.createLinearGradient(0, HEIGHT * 0.35, 0, HEIGHT)
    shade.addColorStop(0, 'rgba(0, 0, 0, 0)')
    shade.addColorStop(1, 'rgba(0, 0, 0, .72)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }
  const size = fitSize(ctx, text)
  ctx.font = `700 ${size}px ${SERIF}`
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0, 0, 0, .35)'
  ctx.shadowBlur = 24
  const lines = wrap(ctx, text, WIDTH - MARGIN * 2, MAX_LINES)
  const lineHeight = size * 1.24
  lines.forEach((line, index) => {
    ctx.fillText(line, MARGIN, HEIGHT - MARGIN - (lines.length - 1 - index) * lineHeight)
  })
  return canvas
}

export async function coverDataUrl(options) {
  const canvas = await composeCover(options)
  return canvas.toDataURL('image/jpeg', 0.9)
}

export async function downloadCover(options, name) {
  const url = await coverDataUrl(options)
  const link = document.createElement('a')
  link.href = url
  link.download = `${String(name).replace(/[\\/:*?"<>|\s]+/g, ' ').trim().slice(0, 40) || t('Video cover')}.jpg`
  link.click()
}
