const { test } = require('node:test')
const assert = require('node:assert/strict')

// Stub external services so route behavior is deterministic, including failures.
const articles = [
  { source: 'The Guardian', title: 'Bridge repairs', contentFull: 'A free shuttle will run during the bridge closure.', url: 'https://example.com/a' },
  { source: 'New York Times', title: 'Bridge repairs', contentFull: 'The bridge will close for repairs.', url: 'https://example.com/b' },
]
const coverage = { status: 'complete', findings: [{ detail: 'Free shuttle service', articles: [
  { articleId: 0, status: 'mentioned', quote: articles[0].contentFull },
  { articleId: 1, status: 'not_found', quote: '' },
] }] }
let failCoverage = false
function stub(path, exports) {
  require.cache[require.resolve(path)] = { id: require.resolve(path), filename: require.resolve(path), loaded: true, exports }
}
stub('./agents/orchestrator', { orchestrate: async () => ({ searchQueries: ['bridge'], selectedSources: [] }) })
stub('./agents/judge', { judge: async () => ({ neutralSummary: 'Bridge repairs are planned.', sources: [] }) })
stub('./fetchers/guardianFetcher', { fetchGuardian: async () => [articles[0]] })
stub('./fetchers/nytFetcher', { fetchNYT: async () => [articles[1]] })
stub('./agents/coverage', { compareCoverage: async (received) => {
  assert.deepEqual(received, articles)
  if (failCoverage) throw new Error('Simulated coverage service failure')
  return coverage
} })
const { app } = require('./index')

test('analysis streams coverage results and survives a coverage failure', async () => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    for (const failure of [false, true]) {
      failCoverage = failure
      const response = await fetch(`http://127.0.0.1:${server.address().port}/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: 'Bridge repairs' }),
      })
      assert.equal(response.status, 200)
      assert.match(response.headers.get('content-type'), /text\/event-stream/)
      const events = (await response.text()).trim().split('\n\n').map((part) => JSON.parse(part.slice(6)))
      assert.ok(!events.some((event) => event.error))
      const result = events.find((event) => event.type === 'result').data
      assert.deepEqual(result.articles, articles)
      assert.equal(result.totalSources, 2)
      assert.equal(result.verdict.neutralSummary, 'Bridge repairs are planned.')
      assert.deepEqual(result.coverage, failure ? { status: 'unavailable', findings: [] } : coverage)
      assert.ok(events.some((event) => event.agent === 'judge' && event.status === 'done'))
    }
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
