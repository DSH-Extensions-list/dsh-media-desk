#!/usr/bin/env node
// A fake monid command for the sandbox. It answers exactly the three endpoints the adapters
// in src/monid.js call, with the same field shapes as the real responses. All content is
// invented, the ids are fixed so a second import dedupes, and it costs nothing.
import { existsSync } from 'node:fs'

const args = process.argv.slice(2)
const say = value => console.log(JSON.stringify(value))
const fail = (message) => {
  say({ error: { code: 'UNKNOWN', message } })
  process.exit(1)
}

if (existsSync(new URL('./nokey', import.meta.url))) {
  say({ error: { code: 'AUTH_FAILED', message: 'No active API key.' } })
  process.exit(1)
}
if (args[0] === 'balance') {
  say({ balance: { value: 12.5, currency: 'USD' }, held: {}, topup: {} })
  process.exit(0)
}
if (args[0] !== 'run') fail('unexpected command')

const endpointAt = args.indexOf('-e')
const endpoint = endpointAt >= 0 ? args[endpointAt + 1] : undefined
const now = Math.floor(Date.now() / 1000)
const done = output => say({ runId: 'mock', status: 'COMPLETED', cost: { value: 0.01, currency: 'USD' }, output })

const bio = 'Small studio, slow videos. One idea a week about finishing the work you already started.'

// Instagram: the profile call is read first, because the posts call needs the numeric user id.
const instagramProfile = {
  code: 0,
  success: true,
  data: {
    user: {
      id: '17841400000000001',
      full_name: 'Nora Fields',
      username: 'norafields',
      biography: bio,
      edge_followed_by: { count: 24800 },
    },
  },
}

const instagramRows = [
  { code: 'Cx7MockReel01', days: 3, likes: 3120, comments: 84, plays: 41800, cover: 'https://example.invalid/instagram-1.jpg', caption: 'I stopped posting daily for a month. Nothing broke, and the work got better: fewer pieces, each one finished properly.' },
  { code: 'Cx7MockReel02', days: 9, likes: 2480, comments: 61, plays: 33700, cover: 'https://example.invalid/instagram-2.jpg', caption: 'The hardest part of making content is deciding what not to say. Cut three points and the piece finally works.' },
  { code: 'Cx7MockReel03', days: 16, likes: 1960, comments: 43, plays: 28400, cover: 'https://example.invalid/instagram-3.jpg', caption: 'One idea, one take, one upload. Readers remember one number better than five arguments.' },
]

const instagramPosts = {
  code: 0,
  success: true,
  items: instagramRows.map(row => ({
    code: row.code,
    caption: { text: row.caption },
    taken_at: now - row.days * 86400,
    image_versions2: { candidates: [{ url: row.cover }] },
    like_count: row.likes,
    comment_count: row.comments,
    ig_play_count: row.plays,
  })),
}

// X: one call returns both the profile and the timeline.
const xRows = [
  { id: '1800000000000000001', days: 2, views: 51200, likes: 1840, replies: 63, bookmarks: 141, retweets: 96, quotes: 12, photo: 'https://example.invalid/x-1.jpg', text: 'The hardest part of making content is deciding what not to say. Cut three points and the piece finally works.' },
  { id: '1800000000000000002', days: 8, views: 43600, likes: 1510, replies: 48, bookmarks: 112, retweets: 74, quotes: 9, photo: 'https://example.invalid/x-2.jpg', text: 'I stopped posting daily for a month. Nothing broke. The only change was that I finished more and shipped less.' },
  { id: '1800000000000000003', days: 15, views: 38100, likes: 1280, replies: 39, bookmarks: 88, retweets: 61, quotes: 7, photo: 'https://example.invalid/x-3.jpg', text: 'Readers remember one number better than five arguments. Pick the number, build the piece around it, then stop.' },
]

const xPosts = {
  code: 0,
  status: 'ok',
  user: { profile: 'norafields', name: 'Nora Fields', desc: bio, sub_count: 31200 },
  timeline: xRows.map(row => ({
    tweet_id: row.id,
    text: row.text,
    created_at: new Date((now - row.days * 86400) * 1000).toISOString(),
    media: [{ media_url_https: row.photo }],
    views: row.views,
    favorites: row.likes,
    replies: row.replies,
    bookmarks: row.bookmarks,
    retweets: row.retweets,
    quotes: row.quotes,
  })),
}

const ENDPOINTS = {
  '/api/v1/instagram/v1/fetch_user_info_by_username': instagramProfile,
  '/api/v1/instagram/v1/fetch_user_posts': instagramPosts,
  '/api/v1/twitter/web/fetch_user_post_tweet': xPosts,
}

const output = ENDPOINTS[endpoint]
if (!output) fail(`unknown endpoint ${endpoint ?? '(missing)'}`)
done(output)
