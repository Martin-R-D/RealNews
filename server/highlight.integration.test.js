const { test } = require('node:test')
const assert = require('node:assert/strict')
const { request } = require('node:http')
const { prepareHighlight } = require('./agents/highlight')
let mode = 'success'
let aborted
const highlightPath = require.resolve('./agents/highlight')
require.cache[highlightPath].exports = { prepareHighlight, analyzeHighlight: async (input, { signal }) => {
  if (mode === 'disconnect') return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted(); reject(new Error('cancelled')) }, { once: true })
  })
  if (mode === 'error') throw new Error('Simulated provider error')
  if (mode === 'timeout') { const error = new Error('Simulated timeout'); error.name = 'APIConnectionTimeoutError'; throw error }
  assert.ok(!signal.aborted)
  return { biasScore: 5, neutralVersion: input.selectedText, howOthersSaidIt: [] }
} }
const { app } = require('./index')
const selectedText = 'The central bridge will close for scheduled repairs.'
const payload = { selectedText, sourceName: 'A', selectedArticleId: 0, allArticles: [{ source: 'A', contentFull: selectedText }] }

test('highlight HTTP responses, errors, and client disconnect cancellation', async () => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}/highlight`
  const post = body => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  try {
    let response = await post(payload)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).neutralVersion, selectedText)
    response = await post({ ...payload, selectedArticleId: 999 })
    assert.equal(response.status, 400)
    mode = 'error'
    response = await post(payload)
    assert.equal(response.status, 502)
    assert.match((await response.json()).error, /try again/)
    mode = 'timeout'
    response = await post(payload)
    assert.equal(response.status, 504)
    assert.match((await response.json()).error, /too long/)
    mode = 'disconnect'
    const cancelled = new Promise(resolve => { aborted = resolve })
    const req = request(url, { method: 'POST', headers: { 'content-type': 'application/json' } })
    req.on('error', () => {})
    req.end(JSON.stringify(payload))
    // Allow the handler to start before dropping the browser connection.
    await new Promise(resolve => setTimeout(resolve, 50))
    req.destroy()
    await Promise.race([cancelled, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Server did not cancel AI request')), 2000); timer.unref() })])
  } finally { await new Promise(resolve => server.close(resolve)) }
})
