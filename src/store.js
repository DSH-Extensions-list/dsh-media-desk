// Persistence: $DSH_HOME/media-desk/state.json. The desktop app and the web UI read the same file.
// Two Host processes can run at once, so every write checks the mtime before re-reading.
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { buildSeed, migrateState } from './seed.js'

const MAX_UNDO = 30

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const keyed = list => list.every(row => isObject(row) && typeof row.id === 'string')

function revertList(before, after, current) {
  const was = new Map(before.map(row => [row.id, row]))
  const now = new Map(after.map(row => [row.id, row]))
  // Drop rows this step added, roll back shared rows field by field, keep everything added later
  const result = current
    .filter(row => !(now.has(row.id) && !was.has(row.id)))
    .map(row => (was.has(row.id) && now.has(row.id) ? revertChange(was.get(row.id), now.get(row.id), row) : row))
  // Put rows this step deleted back where they were
  const present = new Set(result.map(row => row.id))
  before.forEach((row, index) => {
    if (now.has(row.id) || present.has(row.id)) return
    result.splice(Math.min(index, result.length), 0, structuredClone(row))
    present.add(row.id)
  })
  return result
}

/**
 * Three-way undo: revert only what this step changed and nothing has touched since.
 * Undoing a style switch won't erase a draft produced afterwards; undoing a chat
 * title edit won't roll back an image drawn later.
 * @param {*} before - Value before the step.
 * @param {*} after - Value after the step.
 * @param {*} current - Value now.
 * @returns {*} The reverted value.
 */
export function revertChange(before, after, current) {
  if (same(before, after)) return current
  if (same(current, after)) return before === undefined ? undefined : structuredClone(before)
  if (isObject(before) && isObject(after) && isObject(current)) {
    const result = { ...current }
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const value = revertChange(before[key], after[key], current[key])
      if (value === undefined) delete result[key]
      else result[key] = value
    }
    return result
  }
  if (Array.isArray(before) && Array.isArray(after) && Array.isArray(current)) {
    if (keyed(before) && keyed(after) && keyed(current) && (before.length || after.length)) return revertList(before, after, current)
    if (before.length === after.length && after.length === current.length) return current.map((row, index) => revertChange(before[index], after[index], row))
  }
  // Changed again since and not mergeable item by item: keep the current value
  return current
}

export function dshHome(env = process.env) {
  return env.DSH_HOME || join(homedir(), '.dsh')
}

export class Store {
  constructor(root = join(dshHome(), 'media-desk')) {
    this.root = root
    this.file = join(root, 'state.json')
    this.filesDir = join(root, 'files')
    this.state = null
    this.mtimeMs = 0
    this.undo = []
    this.queue = Promise.resolve()
  }

  async refresh() {
    await mkdir(this.filesDir, { recursive: true })
    let info = null
    try {
      info = await stat(this.file)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    if (!info) {
      this.state = buildSeed(new Date())
      await this.persist()
      return
    }
    if (this.state && info.mtimeMs === this.mtimeMs) return
    this.state = migrateState(JSON.parse(await readFile(this.file, 'utf8')))
    this.mtimeMs = info.mtimeMs
  }

  async persist() {
    const tmp = `${this.file}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(this.state))
    await rename(tmp, this.file)
    this.mtimeMs = (await stat(this.file)).mtimeMs
  }

  /** Serialise work so concurrent writes in one process don't overwrite each other. */
  run(task) {
    const next = this.queue.then(task, task)
    this.queue = next.catch(() => {})
    return next
  }

  read() {
    return this.run(async () => {
      await this.refresh()
      return this.state
    })
  }

  /**
   * @param {string} label - Text shown on the undo entry.
   * @param {(state: object) => any} mutate - Modify the state in place.
   * @param {{undoable?: boolean}} [options]
   * @returns {Promise<any>} Whatever mutate returns.
   */
  mutate(label, mutate, { undoable = true } = {}) {
    return this.run(async () => {
      await this.refresh()
      const before = undoable ? JSON.stringify(this.state) : null
      const result = await mutate(this.state)
      if (undoable) {
        const after = JSON.stringify(this.state)
        // A step that changed nothing takes no undo slot, so Undo never looks dead
        if (after !== before) {
          this.undo.push({ label, before, after })
          if (this.undo.length > MAX_UNDO) this.undo.shift()
        }
      }
      await this.persist()
      return result
    })
  }

  undoLast() {
    return this.run(async () => {
      const entry = this.undo.pop()
      if (!entry) return null
      await this.refresh()
      this.state = revertChange(JSON.parse(entry.before), JSON.parse(entry.after), this.state)
      await this.persist()
      return entry.label
    })
  }
}
