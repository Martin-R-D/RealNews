const { test } = require('node:test')
const assert = require('node:assert/strict')
const { coverageInput, validateFindings, compareCoverage } = require('./coverage')

const articles = [
  { source: 'A', contentFull: 'Police reported twelve arrests at the protest.' },
  { source: 'B', contentShort: 'Police reported eight arrests at the protest.' },
  { source: 'C', contentFull: 'Organizers called for reforms.' },
]
const input = coverageInput(articles)
const finding = { detail: 'Police reported twelve arrests.', articles: [
  { id: 0, status: 'mentioned', quote: 'Police reported twelve arrests' },
  { id: 1, status: 'disputed', quote: 'Police reported eight arrests' },
  { id: 2, status: 'not_found', quote: '' },
] }

test('keeps supported quotes, disagreements, and not-found rows', () => {
  const results = validateFindings({ findings: [finding] }, input)
  assert.equal(results.length, 1)
  assert.equal(results[0].articles[1].status, 'disputed')
  assert.equal(results[0].articles[2].quote, '')
})

test('rejects fabricated quotes, unknown IDs, duplicate IDs, and invalid statuses', () => {
  for (const replacement of [
    { id: 0, status: 'mentioned', quote: 'A fabricated quote about arrests.' },
    { id: 99, status: 'mentioned', quote: 'Police reported twelve arrests' },
    { id: 1, status: 'mentioned', quote: 'Police reported eight arrests' },
    { id: 0, status: 'omitted', quote: '' },
  ]) {
    const candidate = { ...finding, articles: [replacement, ...finding.articles.slice(1)] }
    assert.deepEqual(validateFindings({ findings: [candidate] }, input), [])
  }
})

test('requires evidence, a difference, and multiple publishers', () => {
  const supported = finding.articles.slice(0, 2)
  assert.deepEqual(validateFindings({ findings: [{ ...finding, articles: supported.map((row) => ({ ...row, status: 'mentioned' })) }] }, input), [])
  assert.deepEqual(validateFindings({ findings: [finding] }, input.map((article) => ({ ...article, source: 'A' }))), [])
  assert.deepEqual(validateFindings({ findings: [{ ...finding, articles: [{ id: 0, status: 'not_found' }, { id: 1, status: 'not_found' }] }] }, input), [])
})

test('preserves original article IDs when empty excerpts are excluded', () => {
  assert.equal(coverageInput([{ source: 'Empty' }, ...articles])[0].id, 1)
})

test('handles insufficient sources without calling the model', async () => {
  assert.deepEqual(await compareCoverage([]), { status: 'insufficient_sources', findings: [] })
  assert.equal((await compareCoverage([articles[0]])).status, 'insufficient_sources')
})

test('rejects malformed model responses', () => {
  assert.throws(() => validateFindings({}, input), /Invalid coverage response/)
  assert.deepEqual(validateFindings({ findings: [null, {}] }, input), [])
})
