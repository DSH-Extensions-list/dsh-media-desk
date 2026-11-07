import test from 'node:test'
import assert from 'node:assert/strict'
import { parseConnectionInput, parseWebLink } from '../src/source-links.js'

test('people can link arbitrary accounts using handles, ordinary links, or copied share text', () => {
  for (const [value, platform, url] of [
    ['@studio.example', 'Instagram', 'https://www.instagram.com/studio.example/'],
    ['@local_news', 'X', 'https://x.com/local_news'],
    ['r/WritingPrompts', '', 'https://www.reddit.com/r/WritingPrompts'],
    ['/u/another-person', '', 'https://www.reddit.com/user/another-person'],
    ['See this profile (instagram.com/studio.example/?igsh=foo).', 'X', 'https://www.instagram.com/studio.example/'],
    ['https://mobile.twitter.com/local_news?s=20', '', 'https://x.com/local_news'],
    ['https://old.reddit.com/r/WritingPrompts/new/', '', 'https://www.reddit.com/r/WritingPrompts'],
  ]) assert.equal(parseConnectionInput(value, platform)?.url, url, value)
})

test('post and arbitrary website links can be saved individually without linking an account', () => {
  for (const url of [
    'https://www.instagram.com/reel/ExamplePost/',
    'https://x.com/local_news/status/12345678',
    'https://www.reddit.com/r/WritingPrompts/comments/example/',
    'https://example.org/news/a-post',
  ]) {
    assert.equal(parseConnectionInput(url), null)
    assert.equal(parseWebLink('Read this (' + url + ').'), url)
  }
  for (const bad of ['https://x.com@evil.example/account', 'https://x.com.evil.example/account', 'https://instagram.com:444/abc', 'https://user:pass@x.com/account', 'javascript:alert(1)']) {
    assert.equal(parseConnectionInput(bad), null)
  }
  assert.equal(parseWebLink('https://user:pass@example.org/'), null)
  assert.equal(parseWebLink('javascript:alert(1)'), null)
})
