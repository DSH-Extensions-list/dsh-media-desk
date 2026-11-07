// Media Desk settings. The API key lives apart from content data, the file is mode 600,
// and the key is never sent back to the browser.
import { chmod, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tr } from './i18n.js'

const DEFAULTS = {
  image: { baseUrl: '', model: '', apiKey: '', size: '1536x1024', quality: '', extra: '' },
  voice: '',
  exportDir: '',
  imageCount: 2,
  shotCount: 6,
}

function clamp(value, min, max, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

export class Settings {
  constructor(root) {
    this.file = join(root, 'settings.json')
    this.value = null
  }

  async read() {
    // Read the file every time: the desktop and web builds can run at once.
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8'))
      this.value = { ...DEFAULTS, ...saved, image: { ...DEFAULTS.image, ...saved.image } }
      // Older builds stored a language preference. It selects nothing now, so
      // drop it rather than serving a dead field back to the browser.
      delete this.value.language
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      this.value = structuredClone(DEFAULTS)
    }
    return this.value
  }

  /** An empty key means "leave it alone"; only clearKey removes it. */
  async update(patch) {
    const current = await this.read()
    const next = structuredClone(current)
    const image = patch.image ?? {}
    for (const key of ['model', 'size', 'quality']) {
      if (typeof image[key] === 'string') next.image[key] = image[key].trim().slice(0, 200)
    }
    if (typeof image.baseUrl === 'string') {
      const url = image.baseUrl.trim().replace(/\/+$/, '').replace(/\/images\/generations$/, '')
      if (url && !/^https?:\/\/[^\s]+$/i.test(url)) throw Object.assign(new Error(tr('The endpoint must start with http:// or https://')), { status: 400 })
      if (url !== current.image.baseUrl) next.image.apiKey = ''
      next.image.baseUrl = url
    }
    if (typeof image.extra === 'string') {
      const extra = image.extra.trim()
      if (extra) {
        let parsed
        try {
          parsed = JSON.parse(extra)
        } catch {
          parsed = null
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Object.assign(new Error(tr('Extra parameters must be a JSON object')), { status: 400 })
      }
      next.image.extra = extra
    }
    if (typeof image.apiKey === 'string' && image.apiKey.trim()) next.image.apiKey = image.apiKey.trim()
    if (image.clearKey === true) next.image.apiKey = ''
    if (typeof patch.voice === 'string') next.voice = patch.voice.slice(0, 8000)
    if (typeof patch.exportDir === 'string') next.exportDir = patch.exportDir.trim().slice(0, 500)
    if (patch.imageCount !== undefined) next.imageCount = clamp(patch.imageCount, 0, 4, current.imageCount)
    if (patch.shotCount !== undefined) next.shotCount = clamp(patch.shotCount, 0, 12, current.shotCount)
    const tmp = `${this.file}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(next, null, 2), { mode: 0o600 })
    await chmod(tmp, 0o600)
    await rename(tmp, this.file)
    this.value = next
    return next
  }
}

export function imageReady(settings) {
  return Boolean(settings.image.baseUrl && settings.image.model && settings.image.apiKey)
}

/** The copy sent to the browser: whether a key exists, and its last four characters. */
export function publicSettings(settings) {
  const { apiKey, ...image } = settings.image
  return { ...settings, image: { ...image, hasKey: Boolean(apiKey), keyHint: apiKey ? apiKey.slice(-4) : '' }, imageReady: imageReady(settings) }
}
