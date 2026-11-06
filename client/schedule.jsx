// 排期：发布排期和灵感日历是同一张日历。每天一张灵感邮票，发布的内容从右边拖上来。
import React from 'react'
import { dispatchOps, openItem, useDesk } from './desk.js'
import { lang, t, useLang } from './i18n.js'
import { Stamp, useDayMap } from './stamps.jsx'
import { IconButton } from './ui.jsx'
import { STATUS_LABEL, computeStreak, dayKey, displayItem, fmtDate, fmtTime, posterOf, relativeDay, unit } from './util.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
// 中文原文，显示时再翻译
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TYPE = 'text/media-desk-item'

function startDrag(event, id) {
  event.dataTransfer.setData(TYPE, id)
  event.dataTransfer.effectAllowed = 'move'
}

function moveTo(items, id, date) {
  const item = items.find(i => i.id === id)
  if (!item) return
  const target = new Date(date)
  const previous = item.scheduledAt ? new Date(item.scheduledAt) : null
  target.setHours(previous?.getHours() ?? 20, previous?.getMinutes() ?? 0, 0, 0)
  dispatchOps([{ op: 'schedule_item', id, scheduledAt: target.toISOString() }], { label: t('Reschedule') })
}

function Thumb({ item }) {
  const shown = displayItem(item)
  const poster = posterOf(shown)
  return <span className="md-cal-thumb">{poster ? <img src={poster} alt="" draggable={false} loading="lazy" /> : null}</span>
}

function Chip({ item }) {
  const shown = displayItem(item)
  return (
    <button type="button" className={`md-cal-chip status-${item.status}`} draggable title={`${fmtTime(item.scheduledAt)} ${shown.title}`} onDragStart={event => startDrag(event, item.id)} onClick={() => openItem(item.id)}>
      <Thumb item={item} />
      <span className="md-cal-chip-text"><time>{fmtTime(item.scheduledAt)}</time><span>{shown.title}</span></span>
    </button>
  )
}

function Calendar({ items }) {
  const [cursor, setCursor] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [over, setOver] = React.useState(null)
  const days = useDayMap()
  const y = cursor.getFullYear()
  const m = cursor.getMonth()
  const first = new Date(y, m, 1).getDay()
  const cells = []
  for (let i = 0; i < 42; i += 1) cells.push(new Date(y, m, i - first + 1))
  // 2 月 1 日正好是周日时只需要 4 行，多数月份 5 行，少数 6 行
  const rows = cells[28].getMonth() !== m ? cells.slice(0, 28) : cells[35].getMonth() === m ? cells : cells.slice(0, 35)
  const byDay = React.useMemo(() => {
    const map = new Map()
    for (const item of items) {
      if (!item.scheduledAt || item.parentId) continue
      const key = dayKey(item.scheduledAt)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    for (const list of map.values()) list.sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
    return map
  }, [items])
  const today = dayKey(new Date())
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}`
  const monthIdeas = [...days.entries()].filter(([key]) => key.startsWith(prefix)).reduce((sum, [, list]) => sum + list.length, 0)
  const monthPosts = [...byDay.keys()].filter(key => key.startsWith(prefix)).reduce((sum, key) => sum + byDay.get(key).length, 0)
  const streak = computeStreak(items)
  return (
    <section className="md-tile md-cal-tile">
      <header className="md-cal-head">
        <div className="md-cal-num">{String(m + 1).padStart(2, '0')}</div>
        <div className="md-cal-month"><span>{y}</span><em>{MONTHS[m]}</em></div>
        <dl className="md-cal-stats">
          <div><dt>{t('Streak')}</dt><dd>{streak}<small>{unit(streak, 'days')}</small></dd></div>
          <div><dt>{t('Ideas this month')}</dt><dd>{monthIdeas}<small>{t('')}</small></dd></div>
          <div><dt>{t('Posts this month')}</dt><dd>{monthPosts}<small>{t('')}</small></dd></div>
        </dl>
        <span className="md-grow" />
        <IconButton icon="chevL" label={t('Previous month')} onClick={() => setCursor(new Date(y, m - 1, 1))} />
        <button type="button" className="md-pill is-small" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>{t('Today')}</button>
        <IconButton icon="chevR" label={t('Next month')} onClick={() => setCursor(new Date(y, m + 1, 1))} />
      </header>
      <div className="md-cal-weeks">{WEEK.map(w => <span key={w}>{t(w)}</span>)}</div>
      <div className="md-cal-grid" role="grid" style={{ '--rows': rows.length / 7 }}>
        {rows.map((date) => {
          const key = dayKey(date)
          const posts = byDay.get(key) ?? []
          const ideas = days.get(key)
          const isToday = key === today
          return (
            <div
              key={key}
              role="gridcell"
              className={`md-cal-cell ${date.getMonth() !== m ? 'is-outside' : ''} ${isToday ? 'is-today' : ''} ${over === key ? 'is-over' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setOver(key) }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOver(o => (o === key ? null : o)) }}
              onDrop={(event) => {
                event.preventDefault()
                setOver(null)
                const id = event.dataTransfer.getData(TYPE)
                if (id) moveTo(items, id, date)
              }}
            >
              <div className="md-cal-cell-top">
                <span className="md-cal-date">{date.getDate()}</span>
                {ideas?.length || isToday ? <div className="md-cal-stamp"><Stamp list={ideas} today={isToday} label={t('Ideas on {date}', { date: fmtDate(date) })} onOpen={() => openItem(ideas[0].id)} /></div> : null}
              </div>
              <div className="md-cal-posts">
                {posts.slice(0, 2).map(item => <Chip key={item.id} item={item} />)}
                {posts.length > 2 ? <span className="md-cal-more">{t('{n} more', { n: posts.length - 2 })}</span> : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TrayCard({ item }) {
  const shown = displayItem(item)
  const poster = posterOf(shown)
  return (
    <button type="button" draggable className="md-tray-card" onDragStart={event => startDrag(event, item.id)} onClick={() => openItem(item.id)}>
      <span className={`md-tray-cover ${poster ? '' : 'is-type'}`}>
        {poster ? <img src={poster} alt="" loading="lazy" draggable={false} /> : <b>{item.production?.coverText ?? shown.title}</b>}
      </span>
      <span className="md-tray-title">{shown.title}</span>
    </button>
  )
}

function Rail({ items }) {
  const [over, setOver] = React.useState(false)
  const upcoming = items.filter(i => i.scheduledAt && i.status !== 'published' && new Date(i.scheduledAt) >= new Date()).sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
  const next = upcoming[0]
  const waiting = items.filter(i => !i.scheduledAt && !i.parentId && i.status !== 'published')
  const ready = waiting.filter(i => i.production?.status === 'done').sort((a, b) => Date.parse(b.production.finishedAt ?? b.createdAt) - Date.parse(a.production.finishedAt ?? a.createdAt))
  const ideas = waiting.filter(i => i.production?.status !== 'done')
  return (
    <aside className="md-rail-col">
      {next ? (
        <button type="button" className="md-next" onClick={() => openItem(next.id)}>
          <span className="md-next-top"><span>{t('Up next')}</span><span>{relativeDay(next.scheduledAt)}</span></span>
          <b>{fmtTime(next.scheduledAt)}</b>
          <p>{displayItem(next).title}</p>
          <span className="md-next-foot">{next.platform ? `${t(next.platform)} · ` : ''}{t(STATUS_LABEL[next.status])} · {fmtDate(next.scheduledAt)}</span>
        </button>
      ) : null}
      <section
        className={`md-tile md-tray ${over ? 'is-over' : ''}`}
        aria-label={t('Unscheduled')}
        onDragOver={(event) => { event.preventDefault(); setOver(true) }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOver(false) }}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          const id = event.dataTransfer.getData(TYPE)
          if (id && items.find(i => i.id === id)?.scheduledAt) dispatchOps([{ op: 'schedule_item', id, scheduledAt: null }], { label: t('Unschedule') })
        }}
      >
        <header className="md-tile-head"><h2>{t('Unscheduled')}</h2><span className="md-tile-meta">{t('Drag to the calendar')}</span></header>
        <div className="md-tray-scroll">
          {ready.length ? (
            <>
              <h3>{t('Drafted')} <span>{ready.length}</span></h3>
              <div className="md-tray-grid">{ready.map(item => <TrayCard key={item.id} item={item} />)}</div>
            </>
          ) : null}
          <h3>{lang() === 'en' ? t('Ideas') : 'Idea'} <span>{ideas.length}</span></h3>
          {!ready.length && !ideas.length ? <p className="md-tray-empty">{t('Add an idea or finish a draft, then drag it onto the calendar.')}</p> : null}
          <div className="md-tray-list">
            {ideas.map(item => (
              <button type="button" key={item.id} draggable className="md-tray-item" onDragStart={event => startDrag(event, item.id)} onClick={() => openItem(item.id)}>
                <Thumb item={item} />
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </aside>
  )
}

export function ScheduleView() {
  useLang()
  const items = useDesk(s => s.state.items)
  return (
    <div className="md-board-page">
      <div className="md-schedule">
        <Calendar items={items} />
        <Rail items={items} />
      </div>
    </div>
  )
}

