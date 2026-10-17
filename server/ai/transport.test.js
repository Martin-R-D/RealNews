const { test } = require('node:test')
const assert = require('node:assert/strict')
const axios = require('axios')
const { createAIClient } = require('./client')
const env = { CLAUDE_API_KEY: 'test-claude-key', GROQ_API_KEY: 'test-groq-key' }
const options = { messages: [{ role: 'system', content: 'Return JSON.' }, { role: 'user', content: 'Return {"ok":true}' }], maxTokens: 400, temperature: 0, jsonMode: true }

test('real Anthropic HTTP adapter sends the expected URL, auth, model, effort, and message shape', async t => {
  const original = axios.defaults.adapter
  t.after(() => { axios.defaults.adapter = original })
  axios.defaults.adapter = async config => {
    assert.equal(config.url, 'https://api.anthropic.com/v1/messages')
    assert.equal(config.method, 'post')
    assert.equal(config.headers.get('x-api-key'), env.CLAUDE_API_KEY)
    assert.equal(config.headers.get('anthropic-version'), '2023-06-01')
    const body = JSON.parse(config.data)
    assert.equal(body.model, 'claude-haiku-5-5')
    assert.deepEqual(body.output_config, { effort: 'low' })
    assert.equal(body.temperature, undefined)
    assert.equal(body.messages[0].role, 'user')
    assert.match(body.system, /Return JSON/)
    assert.ok(config.signal)
    return { status: 200, headers: {}, config, data: { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"ok":true}' }] } }
  }
  assert.deepEqual(await createAIClient({ env, warn: () => {} })(options), { ok: true })
})

test('real Groq SDK transport still receives its model, JSON mode, sampling settings, and cancellation signal', async t => {
  const originalAdapter = axios.defaults.adapter
  const originalFetch = globalThis.fetch
  t.after(() => { axios.defaults.adapter = originalAdapter; globalThis.fetch = originalFetch })
  axios.defaults.adapter = async () => { throw new Error('Simulated Claude failure') }
  let calls = 0
  globalThis.fetch = async (url, init) => {
    calls++
    assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions')
    assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${env.GROQ_API_KEY}`)
    const body = JSON.parse(init.body)
    assert.equal(body.model, 'openai/gpt-oss-20b')
    assert.deepEqual(body.messages, options.messages)
    assert.equal(body.temperature, 0)
    assert.equal(body.max_tokens, 400)
    assert.deepEqual(body.response_format, { type: 'json_object' })
    assert.ok(init.signal)
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] }), { headers: { 'content-type': 'application/json' } })
  }
  assert.deepEqual(await createAIClient({ env, warn: () => {} })(options), { ok: true })
  assert.equal(calls, 1)
})
