export const DRAFT_IDENTITIES = ['personal', 'brand']
export const DRAFT_FORMATS = ['post', 'graphic', 'video']

export function draftFormat(item) {
  return item.draftFormat ?? (item.draftIdentity ? 'post' : 'video')
}

export function productionSettings(settings, item) {
  return draftFormat(item) === 'video' ? settings : { ...settings, imageCount: 0, shotCount: 0 }
}

export function canDraftFromChat(item, message, focusId) {
  if (!item || item.production?.status === 'done') return false
  if (focusId) return item.id === focusId
  const title = item.title?.trim().toLowerCase()
  return Boolean(!item.imported && title && message.toLowerCase().includes(title))
}
