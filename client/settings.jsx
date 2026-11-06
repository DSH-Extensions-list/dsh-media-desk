// 设置：开放接入的生图模型和保存位置。
import React from 'react'
import { saveSettings, setDesk, testImage, useDesk } from './desk.js'
import { t, useLang } from './i18n.js'
import { Dialog, Icon } from './ui.jsx'

// 常见服务的 OpenAI 兼容地址，模型名以各家文档为准。label 是中文原文，显示时再翻译
const PRESETS = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-1', size: '1536x1024', quality: 'medium', extra: '' },
  { id: 'xai', label: 'xAI', baseUrl: 'https://api.x.ai/v1', model: 'grok-2-image', size: '', quality: '', extra: '' },
  { id: 'ark', label: 'Volcengine Ark', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '', size: '1024x1024', quality: '', extra: '' },
  { id: 'zhipu', label: 'Zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'cogview-4', size: '1024x1024', quality: '', extra: '' },
  { id: 'silicon', label: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', model: '', size: '', quality: '', extra: '{"image_size":"1024x1024"}' },
  { id: 'custom', label: 'Custom', baseUrl: '', model: '', size: '1024x1024', quality: '', extra: '' },
]

// 中文和 English 各用自己的语言写，切错了也认得出来
const LANGUAGES = [
  { value: 'auto', label: () => t('Match DeepSeek Harness') },
  { value: 'zh', label: () => '中文' },
  { value: 'en', label: () => 'English' },
]

export function SettingsDialog() {
  useLang()
  const open = useDesk(s => s.settingsOpen)
  const settings = useDesk(s => s.settings)
  const [form, setForm] = React.useState(null)
  const [testing, setTesting] = React.useState(false)
  const [sample, setSample] = React.useState(null)
  const [advanced, setAdvanced] = React.useState(false)
  React.useEffect(() => {
    if (!open || !settings) return
    const { image } = settings
    setForm({ language: settings.language ?? 'auto', baseUrl: image.baseUrl, model: image.model, apiKey: '', size: image.size, quality: image.quality, extra: image.extra, exportDir: settings.exportDir ?? '', imageCount: settings.imageCount, shotCount: settings.shotCount })
    setSample(null)
  }, [open, settings])
  if (!open || !form) return null
  const close = () => setDesk({ settingsOpen: false })
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const payload = () => ({
    language: form.language,
    image: { baseUrl: form.baseUrl, model: form.model, apiKey: form.apiKey, size: form.size, quality: form.quality, extra: form.extra },
    exportDir: form.exportDir, imageCount: Number(form.imageCount), shotCount: Number(form.shotCount),
  })
  const activePreset = PRESETS.find(p => p.baseUrl && p.baseUrl === form.baseUrl)?.id ?? (form.baseUrl ? 'custom' : null)
  return (
    <Dialog title={t('Settings')} onClose={close} width={520}>
      <form className="md-form" onSubmit={async (event) => {
        event.preventDefault()
        if (await saveSettings(payload())) close()
      }}>
        <div className="md-field">
          <span>{t('Language')}</span>
          <div className="md-presets" role="radiogroup" aria-label={t('Language')}>
            {LANGUAGES.map(option => (
              <button type="button" key={option.value} role="radio" aria-checked={form.language === option.value} className={form.language === option.value ? 'is-on' : ''} onClick={() => set('language', option.value)}>{option.label()}</button>
            ))}
          </div>
        </div>
        <label className="md-field">
          <span>{t('Save drafts to')}</span>
          <input value={form.exportDir} onChange={e => set('exportDir', e.target.value)} placeholder={settings.defaultExportDir} />
        </label>

        <div className="md-field">
          <span>{t('Image model')}</span>
          <div className="md-presets">
            {PRESETS.map(preset => (
              <button type="button" key={preset.id} className={activePreset === preset.id ? 'is-on' : ''} onClick={() => setForm(f => ({ ...f, baseUrl: preset.baseUrl, model: preset.model, size: preset.size, quality: preset.quality, extra: preset.extra }))}>{t(preset.label)}</button>
            ))}
          </div>
          <small>{t('Works with any service compatible with the OpenAI images API (/images/generations).')}</small>
        </div>
        <label className="md-field">
          <span>{t('Endpoint')}</span>
          <input type="url" value={form.baseUrl} onChange={e => set('baseUrl', e.target.value)} placeholder="https://…/v1" />
        </label>
        <label className="md-field">
          <span>{t('Model')}</span>
          <input value={form.model} onChange={e => set('model', e.target.value)} placeholder={t('Model name')} />
        </label>
        <label className="md-field">
          <span>{t('API key')}{settings.image.hasKey ? t(' (saved, ends in {hint})', { hint: settings.image.keyHint }) : ''}</span>
          <input type="password" autoComplete="off" value={form.apiKey} onChange={e => set('apiKey', e.target.value)} placeholder={settings.image.hasKey ? t('Leave blank to keep the current key') : 'sk-…'} />
          <small>{t('Stored only on this computer. Never saved with your content, bundled, or sent to the model.')}</small>
        </label>
        <div className="md-field-row">
          <label className="md-field"><span>{t('Images')}</span><input type="number" min="0" max="4" value={form.imageCount} onChange={e => set('imageCount', e.target.value)} /></label>
          <label className="md-field"><span>{t('Storyboard frames')}</span><input type="number" min="0" max="12" value={form.shotCount} onChange={e => set('shotCount', e.target.value)} /></label>
        </div>
        <button type="button" className="md-advanced" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}><Icon name={advanced ? 'chevD' : 'chevR'} size={12} />{t('Advanced')}</button>
        {advanced ? (
          <>
            <div className="md-field-row">
              <label className="md-field"><span>{t('Size')}</span><input value={form.size} onChange={e => set('size', e.target.value)} placeholder="1536x1024" /></label>
              <label className="md-field"><span>{t('Quality')}</span><input value={form.quality} onChange={e => set('quality', e.target.value)} placeholder="low / medium / high" /></label>
            </div>
            <label className="md-field">
              <span>{t('Extra parameters (JSON)')}</span>
              <input value={form.extra} onChange={e => set('extra', e.target.value)} placeholder='{"output_format":"jpeg"}' />
            </label>
          </>
        ) : null}
        {sample ? <img className="md-test-sample" src={sample} alt={t('Test image')} /> : null}
        <div className="md-form-foot">
          <button type="button" className="md-btn" disabled={testing} onClick={async () => {
            setTesting(true)
            setSample(null)
            setSample(await testImage(payload()))
            setTesting(false)
          }}>{testing ? <span className="md-shimmer">{t('Generating…')}</span> : t('Generate test image')}</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="md-btn" onClick={close}>{t('Cancel')}</button>
          <button type="submit" className="md-btn is-primary">{t('Save')}</button>
        </div>
      </form>
    </Dialog>
  )
}
