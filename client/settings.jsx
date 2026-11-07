// Settings: the configured image model and where drafts are saved.
import React from 'react'
import { saveSettings, setDesk, testImage, useDesk } from './desk.js'
import { t } from './i18n.js'
import { Dialog, Icon } from './ui.jsx'

// OpenAI-compatible endpoints for common services; check each vendor's docs for model names. Labels are translated at display time.
const PRESETS = [
  { id: 'openai-sunburst', label: 'GPT Image 2.6 Sunburst', baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-2.6-sunburst', size: '1536x1024', quality: 'medium', extra: '' },
  { id: 'openai-flare', label: 'GPT Image 2.6 Flare', baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-2.6-flare', size: '1536x1024', quality: 'medium', extra: '' },
  { id: 'xai', label: 'xAI', baseUrl: 'https://api.x.ai/v1', model: 'grok-2-image', size: '', quality: '', extra: '' },
  { id: 'ark', label: 'Volcengine Ark', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '', size: '1024x1024', quality: '', extra: '' },
  { id: 'zhipu', label: 'Zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'cogview-4', size: '1024x1024', quality: '', extra: '' },
  { id: 'silicon', label: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', model: '', size: '', quality: '', extra: '{"image_size":"1024x1024"}' },
  { id: 'custom', label: 'Custom', baseUrl: '', model: '', size: '1024x1024', quality: '', extra: '' },
]

export function SettingsDialog() {
  const open = useDesk(s => s.settingsOpen)
  const settings = useDesk(s => s.settings)
  const [form, setForm] = React.useState(null)
  const [testing, setTesting] = React.useState(false)
  const [sample, setSample] = React.useState(null)
  const [advanced, setAdvanced] = React.useState(false)
  React.useEffect(() => {
    if (!open || !settings) return
    const { image } = settings
    setForm({ baseUrl: image.baseUrl, model: image.model, apiKey: '', size: image.size, quality: image.quality, extra: image.extra, outputFormat: image.outputFormat ?? 'image', frameCount: image.frameCount ?? 9, frameDurationMs: image.frameDurationMs ?? 200, exportDir: settings.exportDir ?? '', imageCount: settings.imageCount, shotCount: settings.shotCount })
    setSample(null)
  }, [open, settings])
  if (!open || !form) return null
  const close = () => setDesk({ settingsOpen: false })
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const supportsGif = /^gpt-image-2\.6-(?:sunburst|flare)(?:-|$)/i.test(form.model)
  const animated = supportsGif && form.outputFormat === 'gif'
  const payload = () => ({
    image: { baseUrl: form.baseUrl, model: form.model, apiKey: form.apiKey, size: form.size, quality: form.quality, extra: form.extra, outputFormat: animated ? 'gif' : 'image', frameCount: Number(form.frameCount), frameDurationMs: Number(form.frameDurationMs) },
    exportDir: form.exportDir, imageCount: Number(form.imageCount), shotCount: Number(form.shotCount),
  })
  const activePreset = PRESETS.find(p => p.baseUrl && p.baseUrl === form.baseUrl && (!p.model || p.model === form.model))?.id ?? (form.baseUrl ? 'custom' : null)
  return (
    <Dialog title={t('Settings')} onClose={close} width={520}>
      <form className="md-form" onSubmit={async (event) => {
        event.preventDefault()
        if (await saveSettings(payload())) close()
      }}>
        <label className="md-field">
          <span>{t('Save drafts to')}</span>
          <input value={form.exportDir} onChange={e => set('exportDir', e.target.value)} placeholder={settings.defaultExportDir} />
        </label>

        <div className="md-field">
          <span>{t('Image model')}</span>
          <div className="md-presets">
            {PRESETS.map(preset => (
              <button type="button" key={preset.id} className={activePreset === preset.id ? 'is-on' : ''} onClick={() => setForm(f => ({ ...f, apiKey: f.baseUrl === preset.baseUrl ? f.apiKey : '', baseUrl: preset.baseUrl, model: preset.model, size: preset.size, quality: preset.quality, extra: preset.extra }))}>{t(preset.label)}</button>
            ))}
          </div>
          <small>{t('GPT Image 2.6 uses an OpenAI API key and API billing. Other OpenAI-compatible image endpoints also work.')}</small>
        </div>
        <label className="md-field">
          <span>{t('Endpoint')}</span>
          <input type="url" value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value, apiKey: '' }))} placeholder="https://…/v1" />
        </label>
        <label className="md-field">
          <span>{t('Model')}</span>
          <input value={form.model} onChange={e => set('model', e.target.value)} placeholder={t('Model name')} />
        </label>
        <label className="md-field">
          <span>{t('API key')}{settings.image.hasKey && settings.image.baseUrl === form.baseUrl ? t(' (saved, ends in {hint})', { hint: settings.image.keyHint }) : ''}</span>
          <input type="password" autoComplete="off" value={form.apiKey} onChange={e => set('apiKey', e.target.value)} placeholder={settings.image.hasKey && settings.image.baseUrl === form.baseUrl ? t('Leave blank to keep the current key') : 'sk-…'} />
          <small>{t('Stored only on this computer. Never saved with your content, bundled, or sent to the model.')}</small>
        </label>
        {supportsGif ? (
          <label className="md-field">
            <span>{t('Output format')}</span>
            <select value={form.outputFormat} onChange={e => set('outputFormat', e.target.value)}>
              <option value="image">{t('Still image')}</option>
              <option value="gif">{t('Animated GIF')}</option>
            </select>
          </label>
        ) : null}
        {animated ? (
          <>
            <div className="md-field-row">
              <label className="md-field"><span>{t('GIF frames')}</span><input type="number" min="2" max="16" value={form.frameCount} onChange={e => set('frameCount', e.target.value)} /></label>
              <label className="md-field"><span>{t('Milliseconds per frame')}</span><input type="number" min="20" max="2000" step="10" value={form.frameDurationMs} onChange={e => set('frameDurationMs', e.target.value)} /></label>
            </div>
            <small className="md-muted">{t('The model chooses the GIF dimensions. The original GIF animates in previews and is included in exports.')}</small>
          </>
        ) : null}
        <div className="md-field-row">
          <label className="md-field"><span>{t('Images')}</span><input type="number" min="0" max="4" value={form.imageCount} onChange={e => set('imageCount', e.target.value)} /></label>
          <label className="md-field"><span>{t('Storyboard frames')}</span><input type="number" min="0" max="12" value={form.shotCount} onChange={e => set('shotCount', e.target.value)} /></label>
        </div>
        <button type="button" className="md-advanced" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}><Icon name={advanced ? 'chevD' : 'chevR'} size={12} />{t('Advanced')}</button>
        {advanced ? (
          <>
            <div className="md-field-row">
              <label className="md-field"><span>{t('Size')}</span><input value={animated ? 'auto' : form.size} disabled={animated} onChange={e => set('size', e.target.value)} placeholder="1536x1024" /></label>
              <label className="md-field"><span>{t('Quality')}</span><input value={form.quality} onChange={e => set('quality', e.target.value)} placeholder="low / medium / high" /></label>
            </div>
            <label className="md-field">
              <span>{t('Extra parameters (JSON)')}</span>
              <input value={form.extra} onChange={e => set('extra', e.target.value)} placeholder='{"output_format":"jpeg"}' />
            </label>
          </>
        ) : null}
        {sample ? <img className="md-test-sample" src={sample} alt={t(animated ? 'Test GIF' : 'Test image')} /> : null}
        <div className="md-form-foot">
          <button type="button" className="md-btn" disabled={testing} onClick={async () => {
            setTesting(true)
            setSample(null)
            setSample(await testImage(payload()))
            setTesting(false)
          }}>{testing ? <span className="md-shimmer">{t('Generating…')}</span> : t(animated ? 'Generate test GIF' : 'Generate test image')}</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="md-btn" onClick={close}>{t('Cancel')}</button>
          <button type="submit" className="md-btn is-primary">{t('Save')}</button>
        </div>
      </form>
    </Dialog>
  )
}
