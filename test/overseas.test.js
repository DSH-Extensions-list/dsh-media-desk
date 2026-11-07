// Overseas platforms: link recognition, response normalisation, Instagram's user-id lookup, and
// Reddit's JSON-first import with its Atom fallback. Reddit fixtures are inline; no test touches
// the network.
import assert from 'node:assert/strict'
import test from 'node:test'
import { importPosts, parseAccountUrl } from '../src/social.js'
import { fetchRedditFeed, fetchRedditPosts, parseRedditProfile, parseRedditSource } from '../src/reddit.js'

test('Overseas profile links: Instagram and X are recognized, while post and feature pages are not accounts', () => {
  assert.deepEqual(parseAccountUrl('https://www.instagram.com/instagram/'), { platform: 'Instagram', id: 'instagram', url: 'https://www.instagram.com/instagram/' })
  assert.equal(parseAccountUrl('https://twitter.com/X').platform, 'X')
  assert.equal(parseAccountUrl('https://x.com/elonmusk').id, 'elonmusk')
  for (const bad of ['https://www.instagram.com/p/DfQCqMnhpsG/', 'https://www.instagram.com/explore/', 'https://x.com/home', 'https://x.com/i/status/1', 'https://x.com/a/status/2']) {
    assert.equal(parseAccountUrl(bad), null, bad)
  }
})

test('Reddit sources: profiles and subreddits are recognized, while lookalike hosts, reserved names and bad names are not', () => {
  assert.deepEqual(parseRedditSource('https://www.reddit.com/user/spez'), { platform: 'Reddit', kind: 'user', id: 'spez', url: 'https://www.reddit.com/user/spez' })
  assert.deepEqual(parseRedditSource('https://reddit.com/u/Some_User-1/'), { platform: 'Reddit', kind: 'user', id: 'Some_User-1', url: 'https://www.reddit.com/user/Some_User-1' })
  assert.deepEqual(parseRedditSource('See https://WWW.REDDIT.COM/R/programming please'), { platform: 'Reddit', kind: 'subreddit', id: 'programming', url: 'https://www.reddit.com/r/programming' })
  assert.deepEqual(parseRedditSource('reddit.com/r/AskReddit/'), { platform: 'Reddit', kind: 'subreddit', id: 'AskReddit', url: 'https://www.reddit.com/r/AskReddit' })
  assert.equal(parseRedditSource('https://www.reddit.com/r/test/new').url, 'https://www.reddit.com/r/test')
  // The user-only helper still works for the callers that import profiles.
  assert.deepEqual(parseRedditProfile('https://www.reddit.com/user/spez'), { platform: 'Reddit', id: 'spez', url: 'https://www.reddit.com/user/spez' })
  assert.equal(parseRedditProfile('https://www.reddit.com/r/programming'), null)
  for (const bad of [
    'https://www.reddit.com/user/me',
    'https://www.reddit.com/u/all',
    'https://www.reddit.com/user/ab',
    `https://www.reddit.com/user/${'a'.repeat(21)}`,
    'https://www.reddit.com/user/bad.name',
    'https://reddit.com.evil.example/user/spez',
    'https://reddit.com.evil.example/r/test',
    'https://notreddit.com/r/test',
    'https://www.reddit.com/r/all',
    'https://www.reddit.com/r/ab',
    `https://www.reddit.com/r/${'a'.repeat(22)}`,
    'https://www.reddit.com/r/bad-name',
    'https://www.reddit.com/r/test/comments/abc/title/',
    'https://www.reddit.com/user/spez/comments',
    'javascript:alert(1)',
  ]) assert.equal(parseRedditSource(bad), null, bad)
})

const JSON_LISTING = {
  kind: 'Listing',
  data: {
    after: null,
    children: [
      {
        kind: 't3',
        data: {
          name: 't3_json1',
          title: 'Modernizing Reddit&#39;s infrastructure with you',
          selftext: 'Hello & welcome to **Reddit**.',
          created_utc: 1786000000,
          permalink: '/r/announcements/comments/json1/modernizing_reddits_infrastructure/',
          score: 321,
          num_comments: 45,
          author: 'spez',
          subreddit: 'announcements',
          url: 'https://example.com/announcement',
        },
      },
      {
        kind: 't3',
        data: {
          name: 't3_json2',
          title: 'A link post with no body',
          selftext: '',
          created_utc: 1786003600,
          permalink: '/r/test/comments/json2/a_link_post/',
          score: 7,
          num_comments: 0,
          author: 'someone',
          subreddit: 'test',
          url: 'https://example.com/link',
        },
      },
    ],
  },
}

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>spez</title>
  <entry>
    <id>t3_abc123</id>
    <title>Modernizing Reddit&#39;s infrastructure with you</title>
    <link href="https://www.reddit.com/r/announcements/comments/abc123/modernizing_reddits_infrastructure/?utm_source=share&amp;utm_medium=rss" />
    <updated>2026-08-05T16:03:56+00:00</updated>
    <author><name>/u/spez</name></author>
    <content type="html">&lt;div class="md"&gt;&lt;p&gt;Hello &amp;amp; welcome to &lt;strong&gt;Reddit&lt;/strong&gt;.&lt;/p&gt;&lt;p&gt;A &amp;quot;quoted&amp;quot; line &amp;#39;with&amp;#39; entities &amp;#x2F; and &amp;#65;.&lt;/p&gt;&lt;/div&gt;</content>
  </entry>
  <entry>
    <id>t3_def456</id>
    <title>Second post</title>
    <link href="https://www.reddit.com/r/test/comments/def456/second/" />
    <updated>2026-08-04T10:00:00Z</updated>
    <author><name>someone</name></author>
    <content type="html">&lt;p&gt;Line one&lt;/p&gt;&lt;p&gt;Line two&lt;/p&gt;</content>
  </entry>
  <entry>
    <id>t3_notitle</id>
    <link href="https://www.reddit.com/r/test/comments/notitle/" />
    <updated>2026-08-03T10:00:00Z</updated>
    <content type="html">&lt;p&gt;No title here&lt;/p&gt;</content>
  </entry>
</feed>`

test('Reddit JSON: the JSON API is tried first and brings score and comment counts', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    return { status: 200, headers: { get: () => null }, text: async () => JSON.stringify(JSON_LISTING) }
  }
  const { posts, via } = await fetchRedditFeed(parseRedditSource('https://www.reddit.com/user/spez'), fetchImpl)
  assert.equal(via, 'json')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://www.reddit.com/user/spez/submitted.json?limit=25&raw_json=1')
  assert.match(calls[0].options.headers.accept, /application\/json/)
  assert.match(calls[0].options.headers['user-agent'], /Mozilla\/5\.0/)
  assert.ok(calls[0].options.signal)
  assert.equal(posts.length, 2)
  assert.deepEqual(posts[0], {
    id: 't3_json1',
    title: "Modernizing Reddit's infrastructure with you",
    body: 'Hello & welcome to **Reddit**.',
    publishedAt: new Date(1786000000 * 1000).toISOString(),
    url: 'https://www.reddit.com/r/announcements/comments/json1/modernizing_reddits_infrastructure/',
    author: 'u/spez',
    score: 321,
    comments: 45,
  })
  // A link post has no selftext, so the title becomes the body and the item stays usable.
  assert.equal(posts[1].body, 'A link post with no body')
  assert.equal(posts[1].score, 7)
  assert.equal(posts[1].comments, 0)
  assert.equal(posts[1].author, 'u/someone')

  calls.length = 0
  const sub = await fetchRedditFeed(parseRedditSource('https://www.reddit.com/r/test'), fetchImpl)
  assert.equal(sub.via, 'json')
  assert.equal(calls[0].url, 'https://www.reddit.com/r/test/new.json?limit=25&raw_json=1')
})

test('Reddit fallback: a blocked JSON API is replaced by the Atom feed in the same call, without numbers', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    if (url.includes('.json')) return { status: 403, headers: { get: () => null }, text: async () => 'BLOCKED BODY' }
    return { status: 200, headers: { get: () => null }, text: async () => ATOM }
  }
  const { posts, via } = await fetchRedditFeed(parseRedditSource('https://www.reddit.com/r/programming'), fetchImpl)
  assert.equal(via, 'rss')
  assert.deepEqual(calls.map(call => call.url), [
    'https://www.reddit.com/r/programming/new.json?limit=25&raw_json=1',
    'https://www.reddit.com/r/programming/new/.rss',
  ])
  assert.match(calls[1].options.headers.accept, /application\/atom\+xml/)
  assert.equal(posts.length, 2)
  assert.equal(posts[0].id, 't3_abc123')
  assert.equal(posts[0].title, "Modernizing Reddit's infrastructure with you")
  assert.equal(posts[0].body, 'Hello & welcome to Reddit. A "quoted" line \'with\' entities / and A.')
  assert.equal(posts[0].publishedAt, '2026-08-05T16:03:56+00:00')
  assert.equal(posts[0].url, 'https://www.reddit.com/r/announcements/comments/abc123/modernizing_reddits_infrastructure/?utm_source=share&utm_medium=rss')
  assert.equal(posts[0].author, 'u/spez')
  assert.equal(posts[0].score, null)
  assert.equal(posts[0].comments, null)
  assert.equal(posts[1].id, 't3_def456')
  assert.equal(posts[1].body, 'Line one Line two')
  assert.equal(posts[1].author, 'u/someone')

  // A user feed belongs to one author even when an entry omits the author block.
  const bareAtom = '<feed><entry><id>t3_noauthor</id><title>No author</title><link href="https://www.reddit.com/r/test/comments/noauthor/x/" /><updated>2026-08-05T16:03:56+00:00</updated><content type="html">&lt;p&gt;Body&lt;/p&gt;</content></entry></feed>'
  const userFeed = await fetchRedditFeed(parseRedditSource('https://www.reddit.com/user/spez'), async url => (url.includes('.json')
    ? { status: 403, headers: { get: () => null }, text: async () => 'blocked' }
    : { status: 200, headers: { get: () => null }, text: async () => bareAtom }))
  assert.equal(userFeed.via, 'rss')
  assert.equal(userFeed.posts[0].author, 'u/spez')
})

test('Reddit fallback: a 200 response that is not JSON also falls back, and JSON is never retried in a loop', async () => {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    if (url.includes('.json')) return { status: 200, headers: { get: () => null }, text: async () => '<html>not json</html>' }
    return { status: 200, headers: { get: () => null }, text: async () => ATOM }
  }
  const { via } = await fetchRedditFeed({ platform: 'Reddit', kind: 'user', id: 'spez', url: 'https://www.reddit.com/user/spez' }, fetchImpl)
  assert.equal(via, 'rss')
  assert.equal(calls.filter(url => url.includes('.json')).length, 1)
  assert.equal(calls.length, 2)
})

test('Reddit feed: at most 25 posts are returned and a long body is capped', async () => {
  const long = 'x'.repeat(5000)
  const entries = Array.from({ length: 30 }, (_, index) => `<entry><id>t3_${index}</id><title>Post ${index}</title><updated>2026-08-05T16:03:56+00:00</updated><link href="https://www.reddit.com/r/test/comments/${index}/post_${index}/" /><author><name>/u/user${index}</name></author><content type="html">&lt;p&gt;${index === 0 ? long : `Body ${index}`}&lt;/p&gt;</content></entry>`).join('')
  const fetchImpl = async url => (url.includes('.json')
    ? { status: 403, headers: { get: () => null }, text: async () => 'blocked' }
    : { status: 200, headers: { get: () => null }, text: async () => `<feed>${entries}</feed>` })
  const { posts, via } = await fetchRedditFeed(parseRedditSource('https://www.reddit.com/user/spez'), fetchImpl)
  assert.equal(via, 'rss')
  assert.equal(posts.length, 25)
  assert.equal(posts[0].body.length, 4000)
  assert.equal(posts[24].id, 't3_24')
  assert.equal(posts[0].author, 'u/user0')
})

test('fetchRedditPosts keeps working as a profile-only wrapper', async () => {
  const posts = await fetchRedditPosts('spez', async () => ({ status: 200, headers: { get: () => null }, text: async () => JSON.stringify(JSON_LISTING) }))
  assert.equal(posts.length, 2)
  assert.equal(posts[0].score, 321)
  await assert.rejects(fetchRedditPosts('bad.name', async () => assert.fail('should not fetch')), /username is not valid/)
})

test('Reddit errors: 403 and 429 stay readable, name the feed fallback and never echo the response body', async () => {
  const secret = 'SECRET RESPONSE BODY'
  const fail = status => async () => ({ status, headers: { get: () => null }, text: async () => secret })
  await assert.rejects(fetchRedditFeed(parseRedditSource('https://www.reddit.com/user/spez'), fail(403)), (err) => {
    assert.match(err.message, /Reddit refused the request \(HTTP 403\)/)
    assert.match(err.message, /datacentre IPs/)
    assert.match(err.message, /JSON API was tried first/)
    assert.match(err.message, /feed fallback was attempted/)
    assert.doesNotMatch(err.message, /SECRET/)
    return true
  })
  await assert.rejects(fetchRedditFeed(parseRedditSource('https://www.reddit.com/user/spez'), fail(429)), (err) => {
    assert.match(err.message, /Reddit rate-limited the request \(HTTP 429\)/)
    assert.match(err.message, /Wait a few minutes/)
    assert.match(err.message, /feed fallback was attempted/)
    assert.doesNotMatch(err.message, /SECRET/)
    return true
  })
  await assert.rejects(fetchRedditFeed({ platform: 'Reddit', kind: 'user', id: 'bad.name', url: '' }, async () => assert.fail('should not fetch')), /not valid/)
})

test('Reddit imports: a JSON user import writes metric rows, while subreddit and feed imports write none', () => {
  const post = {
    id: 't3_json1', title: 'A post', body: 'Body', publishedAt: '2026-08-05T16:03:56+00:00',
    url: 'https://www.reddit.com/r/test/comments/json1/a_post/', author: 'u/spez', score: 321, comments: 45,
  }
  const user = { items: [], metrics: [], accounts: [] }
  importPosts(user, {
    account: { platform: 'Reddit', id: 'u/spez', url: 'https://www.reddit.com/user/spez' },
    profile: { nickname: 'u/spez', description: '', followers: null },
    posts: [{ ...post, views: 0, likes: post.score, comments: post.comments, shares: 0, saves: 0 }],
    withMetrics: true,
  })
  assert.equal(user.items.length, 1)
  assert.equal(user.items[0].externalId, 'Reddit:t3_json1')
  assert.equal(user.items[0].source, 'u/spez')
  assert.equal(user.items[0].author, 'u/spez')
  assert.equal(user.metrics.length, 1)
  assert.deepEqual(
    { views: user.metrics[0].views, likes: user.metrics[0].likes, comments: user.metrics[0].comments, shares: user.metrics[0].shares, saves: user.metrics[0].saves },
    { views: 0, likes: 321, comments: 45, shares: 0, saves: 0 },
  )
  assert.equal(user.accounts[0].externalId, 'Reddit:u/spez')
  assert.equal(user.accounts[0].handle, 'u/spez')
  assert.equal(user.accounts[0].followers, null)

  const sub = { items: [], metrics: [], accounts: [] }
  importPosts(sub, {
    account: { platform: 'Reddit', id: 'r/test', url: 'https://www.reddit.com/r/test' },
    profile: { nickname: 'r/test', description: '', followers: null },
    posts: [{ ...post, author: 'u/someone' }],
    withMetrics: false,
  })
  assert.equal(sub.items[0].source, 'r/test')
  assert.equal(sub.items[0].author, 'u/someone')
  assert.equal(sub.accounts[0].externalId, 'Reddit:r/test')
  assert.equal(sub.metrics.length, 0)

  const rss = { items: [], metrics: [], accounts: [] }
  importPosts(rss, {
    account: { platform: 'Reddit', id: 'u/spez', url: 'https://www.reddit.com/user/spez' },
    profile: { nickname: 'u/spez', description: '', followers: null },
    posts: [{ ...post, score: null, comments: null }],
    withMetrics: false,
  })
  assert.equal(rss.metrics.length, 0)

  const noNumbers = { items: [], metrics: [], accounts: [] }
  importPosts(noNumbers, {
    account: { platform: 'Reddit', id: 'u/spez', url: 'https://www.reddit.com/user/spez' },
    profile: { nickname: 'u/spez', description: '', followers: null },
    posts: [{ ...post, likes: null, comments: null }],
    withMetrics: true,
  })
  assert.equal(noNumbers.metrics.length, 0)
})

test('Reddit imports update in place and create no metric rows by default', () => {
  const account = { platform: 'Reddit', id: 'u/spez', url: 'https://www.reddit.com/user/spez' }
  const posts = [{ id: 't3_abc123', title: 'A post', body: 'Body', publishedAt: '2026-08-05T16:03:56+00:00', url: 'https://www.reddit.com/r/test/comments/abc123/a_post/', author: 'u/spez', score: 12, comments: 3 }]
  const draft = { items: [], metrics: [], accounts: [] }
  assert.deepEqual(importPosts(draft, { account, profile: { nickname: 'u/spez', description: '', followers: null }, posts }), { added: 1, updated: 0 })
  assert.equal(draft.items[0].externalId, 'Reddit:t3_abc123')
  assert.equal(draft.items[0].author, 'u/spez')
  assert.equal(draft.metrics.length, 0)
  assert.equal(draft.accounts[0].externalId, 'Reddit:u/spez')
  assert.deepEqual(importPosts(draft, { account, profile: { nickname: 'u/spez', description: 'edited', followers: null }, posts }), { added: 0, updated: 1 })
  assert.equal(draft.items.length, 1)
  assert.equal(draft.accounts.length, 1)
  assert.equal(draft.accounts[0].description, 'edited')
})
