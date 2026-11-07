import test from 'node:test'
import assert from 'node:assert/strict'
import { articlePrompts, planPrompts } from '../src/ai.js'
import { canDraftFromChat, productionSettings } from '../src/draft-brief.js'

const idea = { id: 'roll', title: 'Weekly roll call', body: 'Ask what people shipped and where they are stuck.', draftIdentity: 'brand', draftBrand: 'BharatCode.ai', draftFormat: 'post', draftStyleId: null }
const state = { skills: [{ name: 'Wrong workflow', rule: 'Explain how to install the Claude Code plugin', status: 'active' }], styles: [{ id: 'old', summary: 'Talk about Claude Code' }], activeStyleId: 'old', angles: [], items: [idea] }

test('a brand roll call uses the item brief and excludes unrelated global style and rules', () => {
  const settings = { imageCount: 2, shotCount: 6 }
  const plan = planPrompts(state, idea, productionSettings(settings, idea))
  const draft = articlePrompts(state, idea, '', {})
  for (const prompt of [plan, draft]) {
    assert.match(prompt.user, /BharatCode\.ai/)
    assert.match(prompt.user, /Weekly roll call/)
    assert.match(prompt.system, /write that invitation/i)
    assert.match(prompt.system, /Never invent first-person updates/)
    assert.doesNotMatch(prompt.system, /install the Claude Code plugin|Talk about Claude Code/)
  }
  assert.equal(productionSettings(settings, idea).shotCount, 0)
  assert.equal(productionSettings(settings, { ...idea, draftFormat: 'graphic' }).imageCount, 0)
  assert.equal(productionSettings(settings, { title: 'Existing video' }), settings)
})

test('chat only drafts a selected or explicitly named idea', () => {
  assert.equal(canDraftFromChat(idea, 'draft it', idea.id), true)
  assert.equal(canDraftFromChat({ id: 'other', title: 'Claude Code plugins' }, 'draft it', idea.id), false)
  assert.equal(canDraftFromChat(idea, 'draft something', undefined), false)
  assert.equal(canDraftFromChat(idea, 'Draft Weekly roll call', undefined), true)
  assert.equal(canDraftFromChat({ ...idea, imported: true }, 'Draft Weekly roll call', undefined), false)
})
