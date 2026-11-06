// 风格：按博主类型分板块的预设，加上从自己账号提炼的专属风格。选哪张，就按哪张写。
import React from 'react'
import { dispatchOps, exportSkills, extractStyle, learnSkills, setDesk, useDesk } from './desk.js'
import { ConnectDialog } from './connect.jsx'
import { lang, t, useLang } from './i18n.js'
import { Dialog, Icon, IconButton } from './ui.jsx'
import { STYLE_CATEGORIES, hash, styleIcon } from './util.js'

function AddStyleDialog({ initialTab, onClose, onConnect }) {
  const [tab, setTab] = React.useState(initialTab)
  const [text, setText] = React.useState('')
  const [urls, setUrls] = React.useState('')
  const [name, setName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    const ok = await extractStyle(tab === 'text' ? { text, name } : { urls: urls.split(/\s+/).filter(Boolean), name })
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <Dialog title={t('Add my style')} onClose={onClose} width={520}>
      <div className="md-capture-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'text'} className={tab === 'text' ? 'is-on' : ''} onClick={() => setTab('text')}>{t('Paste posts')}</button>
        <button type="button" role="tab" aria-selected={tab === 'url'} className={tab === 'url' ? 'is-on' : ''} onClick={() => setTab('url')}>{t('Paste links')}</button>
      </div>
      <form className="md-form" onSubmit={submit}>
        {tab === 'text' ? (
          <label className="md-field">
            <span>{t('Content')}</span>
            <textarea rows={8} required value={text} onChange={e => setText(e.target.value)} placeholder={t('Paste a few posts you’ve written. The more you add, the better the match.')} />
          </label>
        ) : (
          <label className="md-field">
            <span>{t('Link')}</span>
            <textarea rows={4} required value={urls} onChange={e => setUrls(e.target.value)} placeholder={t('Links to posts you published\nOne per line, up to 5')} />
            <small>{t('Only public pages can be read. Social platforms like TikTok, Instagram and X require sign-in, so ')}<button type="button" className="md-inline-link" onClick={onConnect}>{t('import your account instead')}</button>{t('。')}</small>
          </label>
        )}
        <label className="md-field">
          <span>{t('Name (optional)')}</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('e.g. My voiceover style')} />
        </label>
        <div className="md-form-foot">
          <span style={{ flex: 1 }} />
          <button type="button" className="md-btn" onClick={onClose}>{t('Cancel')}</button>
          <button type="submit" className="md-btn is-primary" disabled={busy}>{busy ? <span className="md-shimmer">{t('Learning…')}</span> : t('Learn style')}</button>
        </div>
      </form>
    </Dialog>
  )
}

function editStyle(style) {
  const sep = lang() === 'en' ? ', ' : '、'
  setDesk({
    dialog: {
      title: t('Edit style'),
      initial: { ...style, icon: styleIcon(style), words: (style.words ?? []).join(sep), avoid: (style.avoid ?? []).join(sep) },
      fields: [
        { name: 'name', label: t('Name'), required: true },
        { name: 'icon', label: t('Icon'), hint: t('One emoji') },
        { name: 'summary', label: t('Summary'), type: 'textarea', rows: 2 },
        { name: 'tone', label: t('Tone'), type: 'textarea', rows: 2 },
        { name: 'sentences', label: t('Sentences'), type: 'textarea', rows: 2 },
        { name: 'opening', label: t('Openings'), type: 'textarea', rows: 2 },
        { name: 'structure', label: t('Structure'), type: 'textarea', rows: 2 },
        { name: 'words', label: t('Go-to phrases'), hint: t('Separate with commas') },
        { name: 'avoid', label: t('Avoid'), hint: t('Separate with commas') },
      ],
      onSubmit: (values) => {
        const list = value => String(value ?? '').split(/[、,，]/).map(v => v.trim()).filter(Boolean)
        dispatchOps([{ op: 'update_style', id: style.id, name: values.name, icon: values.icon ?? '', summary: values.summary ?? '', tone: values.tone ?? '', sentences: values.sentences ?? '', opening: values.opening ?? '', structure: values.structure ?? '', words: list(values.words), avoid: list(values.avoid) }], { label: t('Edit style') })
      },
      onDelete: style.preset ? undefined : () => dispatchOps([{ op: 'delete_style', id: style.id }], { label: t('Delete style “{name}”', { name: style.name }) }),
    },
  })
}

function StyleCard({ style, active }) {
  return (
    <article className={`md-style ${active ? 'is-active' : ''}`}>
      <header>
        <span className={`md-style-icon tone-${hash(style.id) % 6}`} aria-hidden="true">{styleIcon(style)}</span>
        <div>
          <strong>{style.name}</strong>
          <small>{active ? t('In use') : style.preset ? t(style.category) : style.source ?? t('Manual')}</small>
        </div>
        <span className="md-grow" />
        <IconButton icon="edit" label={t('Edit “{name}”', { name: style.name })} onClick={() => editStyle(style)} />
      </header>
      {style.summary ? <p className="md-style-summary">{style.summary}</p> : null}
      {style.samples?.[0] ? <blockquote>{style.samples[0]}</blockquote> : null}
      <footer>
        <button type="button" className={`md-pill is-small ${active ? '' : 'is-primary'}`} onClick={() => dispatchOps([{ op: 'set_style', id: active ? null : style.id }], { label: t('Switch style'), silent: true })}>{active ? t('Stop using') : t('Use this')}</button>
      </footer>
    </article>
  )
}

export function StyleView() {
  useLang()
  const styles = useDesk(s => s.state.styles ?? [])
  const activeId = useDesk(s => s.state.activeStyleId)
  const skills = useDesk(s => s.state.skills)
  const [adding, setAdding] = React.useState(null)
  const [connecting, setConnecting] = React.useState(false)
  const [category, setCategory] = React.useState('All')
  const active = styles.find(row => row.id === activeId)
  const mine = styles.filter(row => !row.preset)
  const presets = styles.filter(row => row.preset)
  const categories = STYLE_CATEGORIES.filter(name => presets.some(row => row.category === name))
  const shown = category === 'All' ? categories : categories.filter(name => name === category)
  const proposed = skills.filter(s => s.status === 'proposed')
  const rules = skills.filter(s => s.status !== 'proposed')
  const rule = skill => (
    <li key={skill.id} className="md-rule">
      <div>
        <strong>{skill.name}</strong>
        <p>{skill.rule}</p>
      </div>
      {skill.status === 'proposed'
        ? <button type="button" className="md-pill is-small is-primary" onClick={() => dispatchOps([{ op: 'update_skill', id: skill.id, status: 'active' }], { label: t('Turn on rule “{name}”', { name: skill.name }), silent: true })}>{t('Turn on')}</button>
        : <button type="button" className="md-pill is-small" onClick={() => dispatchOps([{ op: 'update_skill', id: skill.id, status: 'proposed' }], { label: t('Turn off rule “{name}”', { name: skill.name }), silent: true })}>{t('Turn off')}</button>}
      <IconButton icon="trash" label={t('Delete rule “{name}”', { name: skill.name })} onClick={() => dispatchOps([{ op: 'delete_skill', id: skill.id }], { label: t('Delete rule “{name}”', { name: skill.name }) })} />
    </li>
  )
  return (
    <div className="md-board-page">
      <div className="md-style-page">
        <section className="md-tile md-i-hero md-style-hero">
          <div className="md-hero-copy">
            <h1 className="md-i-line">
              {active ? <>{t('Writing in the')} <span className="md-inline-emoji" aria-hidden="true">{styleIcon(active)}</span> <b>{active.name}</b> {t('style.')}</> : <>{t('Pick a preset and start writing,')}<br />{t('or import your account to learn your own style.')}</>}
            </h1>
            <div className="md-hero-actions">
              <button type="button" className="md-pill is-primary" onClick={() => setConnecting(true)}><Icon name="user" size={14} />{t('Import account')}</button>
              <button type="button" className="md-pill" onClick={() => setAdding('text')}><Icon name="pen" size={14} />{t('Paste posts')}</button>
              <button type="button" className="md-pill" onClick={() => setAdding('url')}><Icon name="link" size={14} />{t('Paste links')}</button>
            </div>
          </div>
        </section>

        {mine.length ? (
          <section className="md-style-section" aria-label={t('My styles')}>
            <h2><span aria-hidden="true">✍️</span>{t('My styles')}</h2>
            <div className="md-style-grid">{mine.map(style => <StyleCard key={style.id} style={style} active={style.id === activeId} />)}</div>
          </section>
        ) : null}

        <div className="md-style-filter" role="tablist" aria-label={t('Creator type')}>
          {['All', ...categories].map(name => <button type="button" key={name} role="tab" aria-selected={category === name} className={category === name ? 'is-on' : ''} onClick={() => setCategory(name)}>{t(name)}</button>)}
        </div>

        {shown.map(name => (
          <section key={name} className="md-style-section" aria-label={t(name)}>
            <h2>{t(name)}</h2>
            <div className="md-style-grid">{presets.filter(row => row.category === name).map(style => <StyleCard key={style.id} style={style} active={style.id === activeId} />)}</div>
          </section>
        ))}

        <section className="md-tile md-rules">
          <header className="md-tile-head">
            <h2>{t('Writing rules')}</h2>
            <span className="md-tile-meta">{t('Applied to every style')}</span>
            <span className="md-grow" />
            <button type="button" className="md-pill is-small" onClick={learnSkills}><Icon name="spark" size={13} />{t('Learn from data')}</button>
            <button type="button" className="md-pill is-small" onClick={exportSkills}><Icon name="bolt" size={13} />{t('Export as skill')}</button>
          </header>
          <ul>
            {proposed.map(rule)}
            {rules.map(rule)}
            {!proposed.length && !rules.length ? <li className="md-muted md-rule-empty">{t('Tell the assistant “From now on, keep titles under 10 words” and a rule shows up here.')}</li> : null}
          </ul>
        </section>
      </div>
      {adding ? <AddStyleDialog initialTab={adding} onClose={() => setAdding(null)} onConnect={() => { setAdding(null); setConnecting(true) }} /> : null}
      {connecting ? <ConnectDialog onClose={() => setConnecting(false)} /> : null}
    </div>
  )
}
