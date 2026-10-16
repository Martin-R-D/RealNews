const { test } = require('node:test')
const assert = require('node:assert/strict')
const { normalizeArticles, buildStoryGroups, sameEvent, createStoryFeed } = require('./storyFeed')
const now = Date.parse('2026-10-17T12:00:00Z')
const article = (source, title, suffix, extra = {}) => ({ source, title, url: `https://example.com/${suffix}`, abstract: 'Officials announced the closure.', publishedAt: '2026-10-17T10:00:00Z', ...extra })
const articles = [
  article('A', 'Riverton central bridge closes for repairs', 'a'),
  article('B', 'Riverton central bridge closes during repairs', 'b'),
  article('C', 'Riverton council votes on school funding', 'c'),
]

test('normalizes headlines and excludes unsafe links, duplicates, and old stories', () => {
  const result = normalizeArticles([
    article('A', '<b>Bridge</b> &amp; repairs', 'a'), articles[0],
    article('B', 'Old report', 'old', { publishedAt: '2026-10-01' }),
    article('C', 'Unsafe', 'unsafe', { url: 'javascript:alert(1)' }),
  ], now)
  assert.equal(result.length, 1)
  assert.equal(result[0].title, 'Bridge & repairs')
})

test('fallback groups specific events without joining broad shared topics', () => {
  assert.equal(sameEvent(articles[0], articles[1]), true)
  assert.equal(sameEvent(articles[0], articles[2]), false)
  const groups = buildStoryGroups(articles)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].sourceCount, 2)
  assert.equal(groups[1].sourceCount, 1)
})

test('validates AI group IDs and keeps each article in at most one group', () => {
  const groups = buildStoryGroups(articles, [[0, 999], [0, 0], [0, 1], [1, 2]])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].sourceCount, 2)
  assert.equal(groups.reduce((count, group) => count + group.articleCount, 0), 3)
})

test('deduplicates publishers and marks new coverage only after a previous observation', () => {
  const duplicateSource = article('A', 'Another bridge report', 'a2')
  const groups = buildStoryGroups([...articles.slice(0, 2), duplicateSource], [[0, 1, 2]], new Set([articles[0].url]))
  assert.equal(groups[0].sourceCount, 2)
  assert.equal(groups[0].articleCount, 3)
  assert.equal(groups[0].isDeveloping, true)
  assert.equal(buildStoryGroups(articles, [[0, 1]])[0].isDeveloping, false)
})

test('shares inflight work, caches results, and tolerates one failed publisher', async () => {
  let calls = 0
  let clock = now
  const get = createStoryFeed({ now: () => clock, ttl: 100, providers: [async () => { calls++; return articles }, async () => { throw new Error('Unavailable') }], group: async () => [[0, 1]] })
  const [first, second] = await Promise.all([get(), get()])
  assert.equal(calls, 1)
  assert.equal(first, second)
  assert.equal(first.partial, true)
  assert.equal(first.sourceCount, 3)
  await get()
  assert.equal(calls, 1)
  clock += 101
  await get()
  assert.equal(calls, 2)
})

test('AI failure falls back to conservative local groups', async () => {
  const get = createStoryFeed({ now: () => now, providers: [async () => articles], group: async () => { throw new Error('AI timeout') } })
  const feed = await get()
  assert.equal(feed.stories[0].sourceCount, 2)
})

test('returns saved coverage after an outage and fails clearly without saved coverage', async () => {
  let offline = false
  let clock = now
  const get = createStoryFeed({ now: () => clock, ttl: 100, providers: [async () => { if (offline) throw new Error('Offline'); return articles }], group: async () => [[0, 1]] })
  const first = await get()
  offline = true; clock += 101
  const saved = await get()
  assert.equal(saved.stale, true)
  assert.equal(saved.updatedAt, first.updatedAt)
  assert.deepEqual(saved.stories, first.stories)
  const empty = createStoryFeed({ providers: [async () => []] })
  await assert.rejects(empty(), /No headlines/)
})
