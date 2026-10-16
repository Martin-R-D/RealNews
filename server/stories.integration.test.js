const { test } = require('node:test')
const assert = require('node:assert/strict')
let fail = false
const path = require.resolve('./services/storyFeed')
const feed = { stories: [{ id: 'bridge', sourceCount: 2, articles: [] }], sourceCount: 2, updatedAt: '2026-10-17T12:00:00Z' }
require.cache[path] = { id: path, filename: path, loaded: true, exports: { getStoryFeed: async () => { if (fail) throw new Error('Provider unavailable'); return feed } } }
const { app } = require('./index')
test('serves the story feed and returns a retryable outage response', async () => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const url = `http://127.0.0.1:${server.address().port}/stories`
    let response = await fetch(url)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), feed)
    fail = true
    response = await fetch(url)
    assert.equal(response.status, 503)
    assert.match((await response.json()).error, /try again/)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
