// Set up account refreshes or save a single link to the idea wall.
import React from 'react'
import { dispatchOps, importAccount, listConnections, openConnectionSetup, updateConnection, useDesk } from './desk.js'
import { parseConnectionInput, parseWebLink } from '../src/source-links.js'
import { t } from './i18n.js'
import { Dialog, Segmented } from './ui.jsx'

const META_DASHBOARD = 'https://developers.facebook.com/apps/'
const META_GUIDE = 'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/'
const PLACEHOLDERS = { Instagram: '@your_account', X: '@your_account', Reddit: 'r/community or u/username' }

function sourceKey(source) {
  if (!source) return null
  const prefix = source.platform === 'Reddit' ? (source.kind === 'subreddit' ? 'r/' : 'u/') : ''
  return source.platform + ':' + prefix + source.id.toLowerCase()
}

function InstagramSetup({ token, setToken, authorized }) {
  return (
    <div className="md-source-guide">
      <label className="md-field">
        <span>{t('Instagram access token')}</span>
        <input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} placeholder={authorized ? t('Leave blank to keep the saved token') : t('Paste the token from Meta')} />
        <small>{t('Media Desk stores the token locally. You can replace it here when it expires.')}</small>
      </label>
      <details open={!authorized || undefined}>
        <summary>{t('How to get an Instagram token')}</summary>
        <ol>
          <li>{t('Open your Meta app and add Instagram API with Instagram Login.')}</li>
          <li>{t('Choose your Instagram Business or Creator account and generate a token with instagram_business_basic.')}</li>
          <li>{t('Paste the token above, then choose Link and import.')}</li>
        </ol>
        <div className="md-source-actions">
          <button type="button" className="md-pill is-small" onClick={() => openConnectionSetup(META_DASHBOARD)}>{t('Open Meta app dashboard')}</button>
          <button type="button" className="md-inline-link" onClick={() => openConnectionSetup(META_GUIDE)}>{t('Read Meta’s setup guide')}</button>
        </div>
      </details>
    </div>
  )
}

export function ConnectDialog({ onClose }) {
  const accounts = useDesk(s => s.state.accounts)
  const [connections, setConnections] = React.useState(null)
  const [loadFailed, setLoadFailed] = React.useState(false)
  const [mode, setMode] = React.useState('account')
  const [busy, setBusy] = React.useState(false)
  const [platform, setPlatform] = React.useState('')
  const [text, setText] = React.useState('')
  const [token, setToken] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [auto, setAuto] = React.useState(true)
  const load = async () => {
    const result = await listConnections()
    setLoadFailed(result === null)
    if (result !== null) setConnections(result)
  }
  React.useEffect(() => { void load() }, [])
  const source = parseConnectionInput(text, platform)
  const url = parseWebLink(text)
  const key = sourceKey(source)
  const linked = connections?.find(row => row.key === key)
  const instagram = source?.platform === 'Instagram' || (!source && platform === 'Instagram')
  const select = (value, automatic = true) => {
    setMode('account')
    setPlatform('')
    setText(value)
    setToken('')
    setAuto(automatic)
  }
  const run = async fn => {
    setBusy(true)
    try { await fn(); await load() } finally { setBusy(false) }
  }
  const saved = accounts.filter(row => row.externalId && row.url && !connections?.some(link => link.key === sourceKey(parseConnectionInput(row.url))))
  const submit = async event => {
    event.preventDefault()
    if (mode === 'link') {
      if (!url) return
      setBusy(true)
      try {
        const host = new URL(url).hostname
        const result = await dispatchOps([{ op: 'add_item', kind: 'web', title: title.trim() || host, url, source: host }], { label: t('Save link') })
        if (result?.receipts?.length) onClose()
      } finally { setBusy(false) }
      return
    }
    if (!source) return
    await run(async () => {
      if (await importAccount({ text: source.url, token, auto: linked ? linked.auto !== false : auto })) select('')
    })
  }
  return (
    <Dialog title={t('Sources')} onClose={onClose} width={560}>
      <Segmented label={t('Add a source')} value={mode} onChange={value => { setMode(value); setToken('') }} options={[
        { value: 'account', label: t('Link an account') },
        { value: 'link', label: t('Save a link') },
      ]} />
      <p className="md-setup-lead">{mode === 'account'
        ? t('Import recent posts from Instagram, X, or Reddit.')
        : t('Save a post, article, or other web page to Ideas. You can open the original link later.')}</p>
      <form className="md-form" onSubmit={submit}>
        {mode === 'account' ? (
          <label className="md-field">
            <span>{t('Platform')}</span>
            <select value={platform} disabled={busy} onChange={e => { setPlatform(e.target.value); setToken('') }}>
              <option value="">{t('Detect from link')}</option>
              <option value="Instagram">Instagram</option>
              <option value="X">X</option>
              <option value="Reddit">Reddit</option>
            </select>
            <small>{t('Choose a platform if you’re entering a handle. Pasted profile links are detected automatically.')}</small>
          </label>
        ) : null}
        <label className="md-field">
          <span>{mode === 'account' ? t('Profile, handle, or subreddit') : t('Web link')}</span>
          <input required value={text} disabled={busy} onChange={e => { setText(e.target.value); setToken('') }} placeholder={mode === 'account' ? (PLACEHOLDERS[platform] || 'https://x.com/your_account') : 'https://example.org/article'} />
          {mode === 'account' && source ? <small>{t('Detected {platform} · {name}', { platform: source.platform, name: source.kind === 'subreddit' ? 'r/' + source.id : source.id })}</small> : null}
        </label>
        {mode === 'account' && text.trim() && !source ? (
          <p className="md-source-note" role="status">{url
            ? t('This link can be saved to Ideas. For recurring imports, use an Instagram or X profile, or a Reddit profile or subreddit.')
            : t('Paste a profile link, or choose a platform and enter a handle. Reddit also accepts r/community or u/username.')}
            {url ? <> <button type="button" className="md-inline-link" onClick={() => { setMode('link'); setToken('') }}>{t('Save this link instead')}</button></> : null}
          </p>
        ) : null}
        {mode === 'link' ? (
          <label className="md-field"><span>{t('Title (optional)')}</span><input value={title} disabled={busy} onChange={e => setTitle(e.target.value)} /></label>
        ) : null}
        {mode === 'account' && instagram ? <InstagramSetup token={token} setToken={setToken} authorized={linked?.authorized} /> : null}
        {mode === 'account' && source && !instagram ? <p className="md-muted">{t('Public posts. No sign-in or API key needed.')}</p> : null}
        <div className="md-form-foot">
          {mode === 'account' && !linked ? <label><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> {t('Refresh every eight hours while DSH is running')}</label> : null}
          <span style={{ flex: 1 }} />
          <button type="submit" className="md-btn is-primary" disabled={busy || (mode === 'link' ? !url : !source || (instagram && !token.trim() && !linked?.authorized))}>
            {busy ? t('Working…') : mode === 'link' ? t('Save to Ideas') : linked ? t('Update and import') : t('Link and import')}
          </button>
        </div>
      </form>
      {mode === 'account' ? (
        <div className="md-source-list">
          {loadFailed ? <p role="status">{t('Couldn’t load saved accounts.')} <button type="button" className="md-inline-link" onClick={() => void load()}>{t('Retry')}</button></p> : null}
          {connections === null && !loadFailed ? <p className="md-muted">{t('Loading connections…')}</p> : null}
          {connections?.length ? <h3>{t('Linked accounts')}</h3> : null}
          {connections?.map(row => (
            <section className="md-connection" key={row.key} aria-label={row.platform + ' · ' + row.id}>
              <strong>{row.platform} · {row.id}</strong>
              <p className="md-muted">{row.lastSuccessAt ? t('Last imported {date}', { date: new Date(row.lastSuccessAt).toLocaleString() }) : t('No successful import yet')}</p>
              {row.error ? <p className="md-muted" role="status">{row.error}</p> : null}
              <div className="md-source-actions">
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
          {saved.length ? <>
            <h3>{t('Previously imported')}</h3>
            <div className="md-saved-accounts">
              {saved.map(row => <button type="button" key={row.id} className="md-pill is-small" onClick={() => select(row.url)}>{row.platform} · {row.handle}</button>)}
            </div>
          </> : null}
        </div>
      ) : null}
    </Dialog>
  )
}
