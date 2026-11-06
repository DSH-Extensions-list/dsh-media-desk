// Account import: Monid for Instagram and X, Reddit's JSON API or public feed for free.
import React from 'react'
import { importAccount, monidStatus, toast, useDesk } from './desk.js'
import { t } from './i18n.js'
import { Dialog, Icon } from './ui.jsx'

const SETUP_LINE = 'set up https://monid.ai/SKILL.md'
// A shell command; the placeholder marks where the key goes.
const KEY_COMMAND = 'monid keys add -k YOUR_KEY -l main'
const KEYS_URL = 'https://app.monid.ai/access/api-keys'
const MONID_PLATFORMS = new Set(['Instagram', 'X'])

function isMonid(found) {
  return Boolean(found && MONID_PLATFORMS.has(found.platform))
}

/** Which Reddit source the text points at. The Host still validates the exact link. */
function redditKind(text) {
  const match = /(?:^|[\s(])(?:https?:\/\/)?(?:www\.)?reddit\.com\/(r|user|u)\/([A-Za-z0-9_-]+)\/?(?:[?#][^\s]*)?(?=$|[\s"'<>),.;!?])/i.exec(String(text ?? ''))
  if (!match) return null
  return match[1].toLowerCase() === 'r' ? 'subreddit' : 'user'
}

/** Cost is estimated from Monid's list price; the import result is the source of truth. Reddit is free. */
function detect(text) {
  const value = String(text ?? '')
  const kind = redditKind(value)
  if (kind) return { platform: 'Reddit', kind, estimate: 'free' }
  if (/instagram\.com/i.test(value)) return { platform: 'Instagram', estimate: '$0.002' }
  if (/(?:^|[/.])(?:x|twitter)\.com/i.test(value)) return { platform: 'X', estimate: '$0.001' }
  return null
}

function CopyLine({ value, label }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast(t('Copied'))
    } catch (err) {
      toast(t('Couldn’t copy: {error}', { error: err.message }), { error: true })
    }
  }
  return (
    <div className="md-copy-line">
      <code>{value}</code>
      <button type="button" className="md-pill is-small" aria-label={label} onClick={copy}><Icon name="copy" size={13} />{t('Copy')}</button>
    </div>
  )
}

function SetupGuide({ status, checking, onCheck }) {
  return (
    <div className="md-setup">
      <p className="md-setup-lead">{t('Instagram and X import through Monid, a third-party data service that charges per request; an account usually costs a few cents. Reddit profiles and subreddits are read from Reddit for free, so a Reddit import does not need Monid.')}</p>
      <ol>
        <li>
          <strong>{t('Send this to a new DeepSeek Harness session')}</strong>
          <span>{t('It will install Monid for you.')}</span>
          <CopyLine value={SETUP_LINE} label={t('Copy install command')} />
        </li>
        <li>
          <strong>{t('Sign up for Monid and create an API key')}</strong>
          <span>{t('Add credit first if your balance is low.')}</span>
          <a href={KEYS_URL} target="_blank" rel="noreferrer">app.monid.ai/access/api-keys</a>
        </li>
        <li>
          <strong>{t('Save the key in your terminal')}</strong>
          <span>{t('Don’t paste the key into chat.')}</span>
          <CopyLine value={t(KEY_COMMAND)} label={t('Copy command')} />
        </li>
      </ol>
      <p className="md-setup-note">{t('Reddit imports work without Monid. Paste a Reddit profile or subreddit link below.')}</p>
      {status?.state === 'nokey' ? <p className="md-setup-note">{t('Monid is installed. Finish step 3 to add your key.')}</p> : null}
      {status?.state === 'error' ? <p className="md-setup-note is-error">{status.message}</p> : null}
      <button type="button" className="md-btn is-primary md-setup-check" onClick={onCheck} disabled={checking}>{checking ? <span className="md-shimmer">{t('Checking…')}</span> : t('Done, check again')}</button>
    </div>
  )
}

function AccountForm({ status, onClose }) {
  const accounts = useDesk(s => s.state.accounts)
  const [text, setText] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const found = detect(text)
  const reddit = found?.platform === 'Reddit' ? found : null
  const monid = isMonid(found)
  const label = reddit
    ? (reddit.kind === 'subreddit' ? t('Subreddit link') : t('Your Reddit profile link'))
    : monid ? t('Organisation or creator account link') : t('Your profile link')
  const hint = reddit
    ? (reddit.kind === 'subreddit'
      ? t('A subreddit import brings that community’s recent posts into Content. Scores and comment counts appear only when Reddit serves its JSON API; when it doesn’t, you get titles, dates and links, and can enter numbers manually or import them from a CSV.')
      : t('A profile import brings your public posts into Content. Scores and comment counts appear only when Reddit serves its JSON API; when it doesn’t, you get titles, dates and links, and can enter numbers manually or import them from a CSV.'))
    : monid
      ? t('Import an organisation or creator account. Instagram and X read the latest 20 public posts and their engagement through Monid. Everything goes to Content, and Media Desk learns your style from it.')
      : t('Paste an Instagram, X or Reddit link. Instagram and X import organisation or creator accounts through Monid; Reddit profiles and subreddits are free.')
  const saved = accounts.filter(row => row.externalId && row.url)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    const ok = await importAccount({ text })
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <form className="md-form" onSubmit={submit}>
      <label className="md-field">
        <span>{label}</span>
        <textarea rows={3} required value={text} onChange={e => setText(e.target.value)} placeholder={t('An Instagram, X or Reddit link. Reddit profiles and subreddits both work, and text copied from the app’s Share button is fine too.')} />
        <small>{hint}</small>
      </label>
      {saved.length ? (
        <div className="md-saved-accounts">
          {saved.map(row => <button type="button" key={row.id} className="md-pill is-small" onClick={() => setText(row.url)}><Icon name="refresh" size={12} />{t(row.platform)} · {row.handle}</button>)}
        </div>
      ) : null}
      {monid ? (
        <p className="md-setup-foot">{t('Your link is sent to Monid and its data providers. Only public data is available, so dashboard-only stats can’t be read.')}</p>
      ) : null}
      {reddit ? (
        <p className="md-setup-foot">{t('Reddit is read for free. Media Desk tries Reddit’s JSON API first so scores and comment counts come through, then falls back to the public Atom feed, which carries titles, dates and links but no numbers. Enter numbers manually or import them from a CSV.')}</p>
      ) : null}
      <div className="md-form-foot">
        <span className="md-monid-balance">{status.state === 'ready' ? (status.balance ? t('Monid balance ${value}', { value: status.balance.value.toFixed(2) }) : t('Monid connected')) : t('Reddit imports work without Monid')}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="md-btn" onClick={onClose}>{t('Cancel')}</button>
        <button type="submit" className="md-btn is-primary" disabled={busy}>
          {busy ? <span className="md-shimmer">{t('Importing…')}</span> : reddit ? t(reddit.kind === 'subreddit' ? 'Import subreddit (free)' : 'Import Reddit (free)') : found ? t('Import {platform} (~{estimate})', { platform: t(found.platform), estimate: found.estimate }) : t('Import')}
        </button>
      </div>
    </form>
  )
}

export function ConnectDialog({ onClose }) {
  const [status, setStatus] = React.useState(null)
  const [checking, setChecking] = React.useState(true)
  const check = React.useCallback(async () => {
    setChecking(true)
    const next = await monidStatus()
    setStatus(next)
    setChecking(false)
    if (next.state === 'missing') toast(t('Monid isn’t installed yet. Start with step 1.'), { error: false })
  }, [])
  React.useEffect(() => {
    let alive = true
    monidStatus().then((next) => {
      if (!alive) return
      setStatus(next)
      setChecking(false)
    })
    return () => { alive = false }
  }, [])
  const ready = status?.state === 'ready'
  return (
    <Dialog title={t('Import account or subreddit')} onClose={onClose} width={500}>
      {!status ? <p className="md-setup-lead md-shimmer">{t('Checking Monid…')}</p> : null}
      {status && !ready ? <SetupGuide status={status} checking={checking} onCheck={check} /> : null}
      {status ? <AccountForm status={status} onClose={onClose} /> : null}
    </Dialog>
  )
}
