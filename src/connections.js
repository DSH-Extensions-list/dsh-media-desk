import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const REFRESH_MS = 8 * 60 * 60 * 1000

export class Connections {
  constructor(root) {
    this.root = root
    this.file = join(root, 'connections.json')
    this.pending = Promise.resolve()
  }

  async read() {
    try {
      return JSON.parse(await readFile(this.file, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      return []
    }
  }

  async list() {
    return (await this.read()).map(({ token, ...row }) => ({ ...row, authorized: Boolean(token) }))
  }

  async due(now) {
    return (await this.read()).filter(row => row.auto !== false
      && (row.lastAttemptAt == null || now - row.lastAttemptAt >= REFRESH_MS))
  }

  change(update) {
    const next = this.pending.then(async () => {
      const rows = await this.read()
      const result = update(rows)
      await mkdir(this.root, { recursive: true })
      const temp = this.file + '.' + randomUUID()
      await writeFile(temp, JSON.stringify(rows), { mode: 0o600 })
      await rename(temp, this.file)
      return result
    })
    this.pending = next.catch(() => {})
    return next
  }

  save(account) {
    const key = account.platform + ':' + account.id.toLowerCase()
    return this.change(rows => {
      const existing = rows.find(row => row.key === key)
      if (existing) {
        const { token, ...fields } = account
        Object.assign(existing, fields)
        if (token) existing.token = token
        return existing
      }
      const row = { ...account, key }
      rows.push(row)
      return row
    })
  }

  setAutomatic(key, auto) {
    return this.change(rows => {
      const row = rows.find(row => row.key === key)
      if (row) row.auto = auto
    })
  }

  record(key, { at, error }) {
    return this.change(rows => {
      const row = rows.find(row => row.key === key)
      if (!row) return
      row.lastAttemptAt = at
      row.error = error
      if (!error) row.lastSuccessAt = at
    })
  }

  remove(key) {
    return this.change(rows => {
      const index = rows.findIndex(row => row.key === key)
      if (index !== -1) rows.splice(index, 1)
    })
  }
}
