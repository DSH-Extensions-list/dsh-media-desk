// 侧边对话：一句话改一切。解析和执行都在 Host，这里只负责展示回执。
import React from 'react'
import { clearChat, openItem, sendChat, setDesk, undo, useDesk } from './desk.js'
import { t } from './i18n.js'
import { Icon, IconButton } from './ui.jsx'

const SUGGESTIONS = [
  'Note: the subway ad line “Slow still gets you there” would make a great opener',
  'What’s coming up?',
  'From now on, keep titles under 10 words',
  'Write up today’s best idea',
]

function Receipt({ receipt }) {
  const clickable = receipt.kind === 'item' && receipt.target
  const Tag = clickable ? 'button' : 'div'
  return (
    <Tag type={clickable ? 'button' : undefined} className="md-receipt" onClick={clickable ? () => openItem(receipt.target) : undefined}>
      <span className="md-receipt-check"><Icon name="check" size={11} stroke={2.2} /></span>
      <span>{receipt.text}</span>
    </Tag>
  )
}

function Message({ message, canUndoThis }) {
  if (message.role === 'user') return <div className="md-msg is-user">{message.text}</div>
  return (
    <div className="md-msg is-bot">
      <p>{message.text}</p>
      {message.receipts?.map((receipt, index) => <Receipt key={index} receipt={receipt} />)}
      {message.errors?.map((error, index) => <p key={index} className="md-msg-error">{error}</p>)}
      {message.notice ? <p className="md-msg-note">{message.notice}</p> : null}
      <footer>
        <span>{message.engine === 'local' ? t('Local rules') : ''}</span>
        {canUndoThis ? <button type="button" onClick={undo}><Icon name="undo" size={12} />{t('Undo')}</button> : null}
      </footer>
    </div>
  )
}

/** 对话面板：首页的助手和成稿工作区共用。每条灵感有自己的对话。 */
export function ChatPanel({ itemId, head, top = null, suggestions, placeholder, disabled = false, intro = true }) {
  const all = useDesk(s => s.state.chat)
  const chat = React.useMemo(() => all.filter(m => (m.itemId ?? null) === (itemId ?? null)), [all, itemId])
  const thinking = useDesk(s => s.thinking)
  const quote = useDesk(s => s.chatQuote)
  const [text, setText] = React.useState('')
  const scroller = React.useRef(null)
  const input = React.useRef(null)

  React.useEffect(() => {
    if (scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [chat.length, thinking])
  React.useLayoutEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [text])
  React.useEffect(() => {
    if (quote) input.current?.focus()
  }, [quote])

  const send = (value) => {
    const message = (value ?? text).trim()
    if (!message || thinking || disabled) return
    setText('')
    sendChat(message)
  }
  const lastBot = [...chat].reverse().find(m => m.role === 'assistant')

  return (
    <div className="md-chat">
      <header className="md-dock-head" data-window-drag="">{head}</header>
      <div className="md-dock-scroll" ref={scroller} aria-live="polite">
        {top}
        {chat.length === 0 && intro ? (
          <div className="md-dock-intro">
            <h3>{t('Just say the word.')}<br />{t('I’ll handle the rest.')}</h3>
            <p>{t('Ask about topics, ideas, content, your schedule, styles or writing rules. Every change can be undone.')}</p>
          </div>
        ) : chat.map(message => <Message key={message.id} message={message} canUndoThis={message === lastBot && message.undoable} />)}
        {thinking ? <div className="md-msg is-bot"><span className="md-shimmer">{t('Working…')}</span></div> : null}
      </div>
      {suggestions?.length ? (
        <div className="md-suggest">
          {suggestions.slice(0, chat.length ? 2 : 4).map(row => <button type="button" key={row} onClick={() => send(row)} disabled={thinking || disabled}>{row}</button>)}
        </div>
      ) : null}
      <form className="md-composer" onSubmit={(event) => { event.preventDefault(); send() }}>
        {quote ? (
          <div className="md-composer-ctx">
            <Icon name="target" size={12} />
            <span>{quote.text ? t('{label}：{text}', { label: quote.label, text: quote.text }) : quote.label}</span>
            <button type="button" aria-label={t('Remove quote')} onClick={() => setDesk({ chatQuote: null })}><Icon name="close" size={11} /></button>
          </div>
        ) : null}
        <textarea
          ref={input}
          rows={1}
          aria-label={t('Message the assistant')}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onChange={e => setText(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              send()
            }
          }}
        />
        <button type="submit" className="md-send" aria-label={t('Send')} disabled={!text.trim() || thinking || disabled}><Icon name="send" size={15} /></button>
      </form>
    </div>
  )
}

export function ChatDock() {
  const model = useDesk(s => s.model)
  const modelOk = useDesk(s => s.modelOk)
  const modelError = useDesk(s => s.modelError)
  const hasChat = useDesk(s => s.state.chat.some(m => !m.itemId))
  return (
    <aside className="md-dock" aria-label={t('Assistant')}>
      <ChatPanel
        head={(
          <>
            <h2>{t('Assistant')}</h2>
            <span className={`md-engine ${!model ? '' : modelOk === false ? 'is-down' : 'is-live'}`} title={!model ? t('No model available. Only basic commands work.') : modelOk === false ? `${t('{model} is unavailable right now. Only basic commands work.', { model })}${modelError ? `\n${modelError}` : ''}` : t('Using the current DeepSeek Harness model, {model}', { model })}>
              <i />{!model ? t('Local rules') : modelOk === false ? t('Model offline') : model}
            </span>
            <span style={{ flex: 1 }} />
            {hasChat ? <IconButton icon="refresh" label={t('Clear chat')} onClick={clearChat} /> : null}
            <IconButton icon="close" label={t('Hide chat')} onClick={() => setDesk({ dockOpen: false })} />
          </>
        )}
        suggestions={SUGGESTIONS.map(row => t(row))}
        placeholder={t('Tell me what to change')}
      />
    </aside>
  )
}
