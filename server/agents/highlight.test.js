const { test } = require('node:test')
const assert = require('node:assert/strict')
const { prepareHighlight, validateHighlight } = require('./highlight')
const selectedText = 'The bridge will close for two weeks for repairs.'
const latePassage = 'The bridge will close for two weeks while workers repair its supports.'
const body = { selectedText, sourceName: 'A', selectedArticleId: 0, allArticles: [
  { source: 'A', contentFull: selectedText },
  { source: 'B', contentFull: 'Unrelated background information. '.repeat(12) + latePassage, url: 'https://example.com/b' },
  { source: 'C', contentShort: 'The bridge will close while repairs take place.' },
] }

test('finds matching evidence beyond character 300 and supports abstract fallback', () => {
  const input = prepareHighlight(body)
  assert.ok(input.comparisons.find((item) => item.source === 'B').passages.includes(latePassage))
  assert.ok(input.comparisons.some((item) => item.source === 'C'))
})

test('rejects invalid selections, mismatched sources, and malformed articles', () => {
  for (const changes of [{ selectedText: 'short' }, { selectedArticleId: 99 }, { sourceName: 'Wrong' }, { selectedText: 'This selection is fabricated text.' }, { allArticles: [null] }]) {
    assert.throws(() => prepareHighlight({ ...body, ...changes }))
  }
})

test('validates exact quotes against supplied passages and supplies trusted source links', () => {
  const input = prepareHighlight(body)
  const data = { biasScore: 10, neutralVersion: selectedText, howOthersSaidIt: [
    { articleId: 1, source: 'Fake name', quote: latePassage },
    { articleId: 2, quote: 'An entirely fabricated quote for this article.' },
    { articleId: 99, quote: latePassage },
    { articleId: 1, quote: latePassage },
  ] }
  const result = validateHighlight(data, input.comparisons)
  assert.equal(result.howOthersSaidIt.length, 1)
  assert.equal(result.howOthersSaidIt[0].source, 'B')
  assert.equal(result.howOthersSaidIt[0].url, 'https://example.com/b')
  assert.throws(() => validateHighlight({ ...data, biasScore: 101 }, input.comparisons))
  assert.throws(() => validateHighlight({ ...data, neutralVersion: '' }, input.comparisons))
})

test('no supported matches returns an honest empty comparison', () => {
  assert.deepEqual(validateHighlight({ biasScore: 0, neutralVersion: selectedText, howOthersSaidIt: [] }, []).howOthersSaidIt, [])
})
