import assert from 'node:assert/strict'
import test from 'node:test'
import { relatedIdeas, relatedLayout, terms } from '../client/related.js'

const items = [
  { id: 'a', title: 'Agents vs. chatbots, explained', tags: ['AI'], createdAt: '2026-11-01' },
  { id: 'b', title: 'A pricing map', body: 'Forty pages, and one agent that read them all.', createdAt: '2026-11-02' },
  { id: 'c', title: 'Old facades', body: 'Again and again the windows change.', createdAt: '2026-11-03' },
  { id: 'd', title: 'Agent vs. chatbot, explained in 30 seconds', createdAt: '2026-10-30' },
  { id: 'e', title: 'Day 300 of a one-person company', body: 'The revenue curve and the afternoon I almost quit.', createdAt: '2026-10-29' },
  { id: 'f', title: 'Just one thing this week', body: 'Cut the path from idea to finished post to under 24 hours', production: { title: 'How a one-person company prices things' }, createdAt: '2026-10-28' },
]

test('relatedIdeas: title hits rank ahead of body hits, and English matches on whole words', () => {
  assert.deepEqual(relatedIdeas(items, 'agent'), ['a', 'd', 'b'])
  assert.deepEqual(relatedIdeas(items, 'agents'), ['a'])
  assert.deepEqual(relatedIdeas(items, 'ai'), ['a'])
  assert.deepEqual(relatedIdeas(items, 'the'), [])
})

test('relatedIdeas: a term in the finished title counts, and common function words do not', () => {
  assert.deepEqual(relatedIdeas(items, 'one-person'), ['e', 'f'])
  assert.deepEqual(relatedIdeas(items, 'the and of'), [])
  assert.ok(terms('AI product pricing').some(row => row.term === 'ai'))
  assert.deepEqual(terms('the and of a').map(row => row.term), [])
})

test('relatedLayout: cards alternate left and right, a column never overlaps, and a tall column opens another one', () => {
  const cards = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, w: 220, h: 300 }))
  const spots = relatedLayout(cards)
  assert.ok(spots.c0.x < 0 && spots.c1.x > 0)
  const left = ['c0', 'c2', 'c4'].map(id => spots[id])
  for (const a of left) for (const b of left) if (a !== b && a.x === b.x) assert.ok(Math.abs(a.y - b.y) >= 300)
  assert.ok(new Set(left.map(p => p.x)).size === 2)
})
