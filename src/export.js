// One-click save: write a draft out as a plain folder with the script, cover, figures and storyboard.
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { extname, join } from 'node:path'
import { tr } from './i18n.js'

export function defaultExportDir() {
  return join(homedir(), 'Documents', 'Media Desk')
}

export function resolveExportDir(value) {
  const dir = String(value ?? '').trim()
  if (!dir) return defaultExportDir()
  return dir.startsWith('~/') ? join(homedir(), dir.slice(2)) : dir
}

function folderName(title) {
  const clean = String(title ?? '').replace(/[\\/:*?"<>|\n\r\t]/g, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 60)
  return clean || tr('Untitled')
}

function cell(text) {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

/**
 * @param {object} production - The finished draft.
 * @param {{filesDir: string, exportDir: string, videoCover?: Buffer}} options - Asset folder, save location and composited video cover.
 * @returns {Promise<{path: string, files: string[]}>} Folder path and written file names.
 */
export async function saveProduction(production, { filesDir, exportDir, videoCover }) {
  // Plain ASCII file names open the same on any OS and in any tool
  const names = { cover: 'cover-original', videoCover: 'video-cover.jpg', figure: i => `figure-${i}`, shot: n => `shot-${n}`, script: 'script.md', board: 'storyboard.md' }
  const target = production.savedPath || join(exportDir, folderName(production.title))
  await mkdir(target, { recursive: true })
  const files = []

  const copy = async (asset, name) => {
    const match = /^media-desk\/files\/([\w.-]+)$/.exec(asset?.src ?? '')
    if (!match) return null
    const file = `${name}${extname(match[1])}`
    await copyFile(join(filesDir, match[1]), join(target, file))
    files.push(file)
    return file
  }

  const cover = await copy(production.cover, names.cover)
  if (videoCover) {
    await writeFile(join(target, names.videoCover), videoCover)
    files.push(names.videoCover)
  }
  const figures = []
  for (const [i, image] of (production.images ?? []).entries()) {
    figures.push({ image, file: await copy(image, names.figure(i + 1)) })
  }
  const shots = []
  for (const [i, shot] of (production.shots ?? []).entries()) {
    shots.push({ shot, file: await copy(shot, names.shot(String(i + 1).padStart(2, '0'))) })
  }

  // Put each figure back at the end of the section its heading names
  const sections = String(production.article ?? '').split(/\n(?=##\s)/)
  const unplaced = []
  for (const { image, file } of figures) {
    if (!file) continue
    const line = `\n\n![${image.caption ?? ''}](${file})`
    const at = sections.findIndex(part => image.anchor && part.startsWith(`## ${image.anchor}`))
    if (at >= 0) sections[at] = `${sections[at].trimEnd()}${line}\n`
    else unplaced.push(line)
  }
  const article = `# ${production.title}\n\n${sections.join('\n')}${unplaced.join('')}\n`
  await writeFile(join(target, names.script), article)
  files.push(names.script)

  if (shots.length) {
    const seconds = value => (value === undefined || value === null ? '' : `${value}s`)
    const rows = shots.map(({ shot, file }, i) => `| ${i + 1} | ${cell(shot.shot)} | ${seconds(shot.seconds)} | ${cell(shot.visual)} | ${cell(shot.voice)} | ${file ? `![](${file})` : ''} |`)
    const heading = `# ${production.title}: storyboard\n\n| Shot | Size | Length | Visual | Voice-over | Frame |`
    await writeFile(join(target, names.board), `${heading}\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`)
    files.push(names.board)
  }
  return { path: target, files }
}
