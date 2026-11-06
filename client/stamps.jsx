// Stamp calendar: one stamp per day, a nudge to note more.
import React from 'react'
import { openCapture } from './card.jsx'
import { openItem, setDesk, useDesk } from './desk.js'
import { t } from './i18n.js'
import { Icon } from './ui.jsx'
import { computeStreak, dayKey, hash, posterOf, isIdea } from './util.js'

export function useDayMap() {
  const items = useDesk(s => s.state.items)
  return React.useMemo(() => {
    const map = new Map()
    for (const item of items) {
      if (!isIdea(item)) continue
      const key = dayKey(item.createdAt)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    return map
  }, [items])
}

function coverOf(list) {
  // Prefer an item with an image for the stamp
  return list.find(item => posterOf(item)) ?? list[0]
}

export function Stamp({ list, today, onOpen, label }) {
  if (!list?.length) {
    return (
      <button type="button" className={`md-stamp is-blank ${today ? 'is-today' : ''}`} aria-label={today ? t('Nothing yet today. Add one') : t('{label}: no ideas', { label })} onClick={today ? () => openCapture('text') : undefined} disabled={!today}>
        {today ? <Icon name="plus" size={16} /> : null}
      </button>
    )
  }
  const cover = coverOf(list)
  const poster = posterOf(cover)
  return (
    <button type="button" className={`md-stamp ${poster ? '' : `is-type tone-${hash(cover.id) % 6}`}`} aria-label={t('{label}: {title} ({n} total)', { label, title: cover.title, n: list.length })} title={cover.title} onClick={onOpen}>
      {poster ? <img src={poster} alt="" loading="lazy" draggable={false} /> : <span>{cover.title.slice(0, 1)}</span>}
      {list.length > 1 ? <i>{list.length}</i> : null}
    </button>
  )
}

/** Below the hero text: stamps for the last ten days. */
export function MiniStamps() {
  const items = useDesk(s => s.state.items)
  const days = useDayMap()
  const streak = computeStreak(items)
  const now = new Date()
  const cells = []
  for (let i = 9; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    cells.push(d)
  }
  return (
    <div className="md-ministamps">
      <div className="md-ministamps-row">
        {cells.map((d) => {
          const key = dayKey(d)
          const list = days.get(key)
          return <Stamp key={key} list={list} today={key === dayKey(now)} label={t('{mon} {d}', { m: d.getMonth() + 1, d: d.getDate(), mon: d.toLocaleString('en-US', { month: 'short' }) })} onOpen={() => openItem(coverOf(list).id)} />
        })}
      </div>
      <button type="button" className="md-ministamps-more" onClick={() => setDesk({ view: 'schedule' })} title={t('Open idea calendar')} aria-label={t('Open idea calendar ({n}-day streak)', { n: streak })}><Icon name="upRight" size={14} /></button>
    </div>
  )
}
