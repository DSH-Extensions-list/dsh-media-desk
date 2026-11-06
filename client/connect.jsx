// 抓账号：先引导用户接好 Monid，再贴主页链接。
import React from 'react'
import { importAccount, monidStatus, toast, useDesk } from './desk.js'
import { t, useLang } from './i18n.js'
import { Dialog, Icon } from './ui.jsx'

const SETUP_LINE = 'set up https://monid.ai/SKILL.md'
// 命令里的占位词要跟着语言走，用的时候再翻译
const KEY_COMMAND = 'monid keys add -k YOUR_KEY -l main'
const KEYS_URL = 'https://app.monid.ai/access/api-keys'

/** 花费是按 Monid 目录价估的，实际花费以导入结果为准。 */
function detect(text) {
  const value = String(text ?? '')
  if (/xiaohongshu\.com|xhslink\.com/i.test(value)) return { platform: 'RedNote', estimate: '$0.02' }
  if (/douyin\.com/i.test(value)) return { platform: 'Douyin', estimate: '$0.002' }
  if (/bilibili\.com|b23\.tv/i.test(value)) return { platform: 'Bilibili', estimate: '$0.003' }
  if (/tiktok\.com/i.test(value)) return { platform: 'TikTok', estimate: '$0.002' }
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
      <p className="md-setup-lead">{t('TikTok, Instagram, X, RedNote, Douyin and Bilibili data comes through Monid, a third-party data service that charges per request. Importing an account usually costs a few cents.')}</p>
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
        <span>{t('Your profile link')}</span>
        <textarea rows={3} required value={text} onChange={e => setText(e.target.value)} placeholder={t('A TikTok, Instagram, X, RedNote, Douyin or Bilibili profile link. Text copied from the app’s Share button works too.')} />
        <small>{t('Only import accounts you own. We’ll read your latest 20 public posts and their engagement, add them to Content and Insights, and learn your style from them.')}</small>
      </label>
      {saved.length ? (
        <div className="md-saved-accounts">
          {saved.map(row => <button type="button" key={row.id} className="md-pill is-small" onClick={() => setText(row.url)}><Icon name="refresh" size={12} />{t(row.platform)} · {row.handle}</button>)}
        </div>
      ) : null}
      <p className="md-setup-foot">
        {t('Your link is sent to Monid and its data providers. Only public data is available, so dashboard-only stats like RedNote and Douyin views can’t be read.')}
      </p>
      <div className="md-form-foot">
        <span className="md-monid-balance">{status.balance ? t('Monid balance ${value}', { value: status.balance.value.toFixed(2) }) : t('Monid connected')}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="md-btn" onClick={onClose}>{t('Cancel')}</button>
        <button type="submit" className="md-btn is-primary" disabled={busy}>
          {busy ? <span className="md-shimmer">{t('Importing…')}</span> : found ? t('Import {platform} (~{estimate})', { platform: t(found.platform), estimate: found.estimate }) : t('Import')}
        </button>
      </div>
    </form>
  )
}

export function ConnectDialog({ onClose }) {
  useLang()
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
    <Dialog title={ready ? t('Import account') : t('Connect Monid')} onClose={onClose} width={500}>
      {!status ? <p className="md-setup-lead md-shimmer">{t('Checking Monid…')}</p> : null}
      {status && !ready ? <SetupGuide status={status} checking={checking} onCheck={check} /> : null}
      {ready ? <AccountForm status={status} onClose={onClose} /> : null}
    </Dialog>
  )
}
