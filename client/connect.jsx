// Link social sources and import their recent posts.
import React from 'react'
import { importAccount, listConnections, openConnectionSetup, updateConnection, useDesk } from './desk.js'
import { t } from './i18n.js'
import { Dialog } from './ui.jsx'

const META_DASHBOARD = 'https://developers.facebook.com/apps/'

function dateLabel(value) {
  return value ? new Date(value).toLocaleString() : t('Never')
}

export function ConnectDialog({ onClose }) {
  const accounts = useDesk(s => s.state.accounts)
  const [connections, setConnections] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [text, setText] = React.useState('')
  const [token, setToken] = React.useState('')
  const [auto, setAuto] = React.useState(true)
  const instagram = /(?:^|[/.])instagram\.com\//i.test(text)
  const load = async () => setConnections(await listConnections() ?? [])
  React.useEffect(() => { void load() }, [])
  const select = (url, automatic = true) => {
    setText(url)
    setToken('')
    setAuto(automatic)
  }
  const run = async fn => {
    setBusy(true)
    try { await fn(); await load() } finally { setBusy(false) }
  }
  const saved = accounts.filter(row => row.externalId && row.url && !connections?.some(link => link.url.toLowerCase() === row.url.toLowerCase()))
  return (
    <Dialog title={t('Linked accounts')} onClose={onClose} width={560}>
      <p className="md-setup-lead">{t('Link Instagram, X or Reddit. Automatic refresh runs about every eight hours while DeepSeek Harness is running.')}</p>
      {connections === null ? <p className="md-muted">{t('Loading connections…')}</p> : connections.map(row => (
        <section className="md-connection" key={row.key} aria-label={row.platform + ' · ' + row.id}>
          <div><strong>{row.platform} · {row.id}</strong></div>
          <p className="md-muted">{t('Last successful import: {date}', { date: dateLabel(row.lastSuccessAt) })}</p>
          {row.error ? <p className="md-muted" role="status">{row.error}</p> : null}
          <div className="md-form-foot">
            <label><input type="checkbox" checked={row.auto !== false} disabled={busy} onChange={event => {
              const enabled = event.target.checked
              void run(() => updateConnection('automatic', { key: row.key, auto: enabled }))
            }} /> {t('Auto-refresh')}</label>
            <button type="button" className="md-pill is-small" disabled={busy} onClick={() => void run(() => importAccount({ key: row.key }))}>{t('Import now')}</button>
            {row.platform === 'Instagram' ? <button type="button" className="md-pill is-small" disabled={busy} onClick={() => select(row.url, row.auto !== false)}>{t('Update token')}</button> : null}
            <button type="button" className="md-pill is-small" disabled={busy} onClick={() => void run(() => updateConnection('disconnect', { key: row.key }))}>{t('Disconnect')}</button>
          </div>
        </section>
      ))}
      <form className="md-form" onSubmit={event => {
        event.preventDefault()
        void run(async () => {
          if (await importAccount({ text, token, auto })) select('')
        })
      }}>
        <label className="md-field">
          <span>{t('Profile or subreddit link')}</span>
          <input required value={text} onChange={e => { setText(e.target.value); setToken('') }} placeholder="https://…" />
          <small>{t('X uses public profile posts. Reddit accepts public profiles and subreddits.')}</small>
        </label>
        {saved.length ? (
          <div className="md-saved-accounts">
            {saved.map(row => <button type="button" key={row.id} className="md-pill is-small" onClick={() => select(row.url)}>{row.platform} · {row.handle}</button>)}
          </div>
        ) : null}
        {instagram ? (
          <div className="md-field">
            <p className="md-muted">{t('In a Meta app, add Instagram API with Instagram Login, then generate an access token for your Business or Creator account with instagram_business_basic.')}</p>
            <button type="button" className="md-pill is-small" onClick={() => openConnectionSetup(META_DASHBOARD)}>{t('Open Meta app dashboard')}</button>
            <label className="md-field">
              <span>{t('Instagram access token')}</span>
              <input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} />
              <small>{t('Saved locally and sent only to Instagram. Paste a new token here when the current one expires.')}</small>
            </label>
          </div>
        ) : null}
        <div className="md-form-foot">
          <label><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> {t('Auto-refresh')}</label>
          <span style={{ flex: 1 }} />
          <button type="submit" className="md-btn is-primary" disabled={busy}>{busy ? t('Working…') : t('Link and import')}</button>
        </div>
      </form>
    </Dialog>
  )
}
