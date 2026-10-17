const { test } = require('node:test')
const assert = require('node:assert/strict')
const { setTimeout: wait } = require('node:timers/promises')
const { createAIClient, CLAUDE_MODEL, GROQ_MODEL } = require('./client')
const env = { CLAUDE_API_KEY: 'test-claude-key', GROQ_API_KEY: 'test-groq-key' }
const options = { messages: [{ role: 'system', content: 'Extract data.' }, { role: 'user', content: 'Return {"ok":true}.' }], maxTokens: 900, temperature: 0, jsonMode: true, validate: (value) => { if (value.ok !== true) throw new Error('Invalid schema'); return value } }
const claudeAnswer = (text = '{"ok":true}', stop_reason = 'end_turn') => ({ stop_reason, content: [{ type: 'thinking', thinking: 'not part of the answer' }, { type: 'text', text }] })
const groqAnswer = (text = '{"ok":true}') => ({ choices: [{ finish_reason: 'stop', message: { content: text } }] })
const silent = () => {}

test('Claude receives Haiku 5.5 low effort and only text blocks become the result', async () => {
  let fallback = 0
  const generate = createAIClient({ env, warn: silent, claude: async (body, request) => {
    assert.equal(body.model, CLAUDE_MODEL)
    assert.deepEqual(body.output_config, { effort: 'low' })
    assert.equal(body.temperature, undefined)
    assert.equal(body.response_format, undefined)
    assert.ok(body.max_tokens > options.maxTokens)
    assert.ok(body.system.startsWith('Extract data.'))
    assert.deepEqual(body.messages, [options.messages[1]])
    assert.equal(request.apiKey, env.CLAUDE_API_KEY)
    assert.ok(request.timeout > 0 && request.timeout <= 600)
    return claudeAnswer()
  }, groq: async () => { fallback++; return groqAnswer() } })
  assert.deepEqual(await generate(options, { timeout: 1000 }), { ok: true })
  assert.equal(fallback, 0)
})

test('Claude HTTP/auth/network failures fall back with original Groq settings', async () => {
  for (const status of [401, 403, 404, 429, 500, 529, undefined]) {
    let calls = 0
    const logs = []
    const generate = createAIClient({ env, warn: message => logs.push(message), claude: async () => { throw Object.assign(new Error('Sensitive provider details test-claude-key'), { status }) }, groq: async (body, request) => {
      calls++
      assert.equal(body.model, GROQ_MODEL)
      assert.equal(body.temperature, 0)
      assert.equal(body.max_tokens, 900)
      assert.deepEqual(body.messages, options.messages)
      assert.deepEqual(body.response_format, { type: 'json_object' })
      assert.equal(body.output_config, undefined)
      assert.equal(request.apiKey, env.GROQ_API_KEY)
      return groqAnswer()
    } })
    assert.deepEqual(await generate(options), { ok: true })
    assert.equal(calls, 1)
    assert.ok(!logs.join(' ').includes('test-claude-key'))
  }
})

test('empty, malformed, refused, truncated and schema-invalid Claude replies trigger fallback', async () => {
  for (const reply of [claudeAnswer(''), claudeAnswer('not JSON'), claudeAnswer('{}'), claudeAnswer('[]'), claudeAnswer('{"ok":true}', 'max_tokens'), claudeAnswer('', 'refusal'), { content: [{ type: 'thinking' }], stop_reason: 'end_turn' }]) {
    let calls = 0
    const generate = createAIClient({ env, warn: silent, claude: async () => reply, groq: async () => { calls++; return groqAnswer() } })
    assert.deepEqual(await generate(options), { ok: true })
    assert.equal(calls, 1)
  }
})

test('Claude timeout cancels that request and preserves time for Groq', async () => {
  let claudeSignal
  let groqTimeout
  const generate = createAIClient({ env, warn: silent, claude: (_, request) => { claudeSignal = request.signal; return new Promise(() => {}) }, groq: async (_, request) => { groqTimeout = request.timeout; return groqAnswer() } })
  assert.deepEqual(await generate(options, { timeout: 150 }), { ok: true })
  assert.equal(claudeSignal.aborted, true)
  assert.ok(groqTimeout > 0 && groqTimeout < 150)
})

test('caller cancellation stops Claude and never starts Groq', async () => {
  const controller = new AbortController()
  let calls = 0
  let signal
  const generate = createAIClient({ env, warn: silent, claude: (_, request) => { signal = request.signal; return new Promise(() => {}) }, groq: async () => { calls++; return groqAnswer() } })
  const pending = generate(options, { signal: controller.signal })
  await wait(5)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(signal.aborted, true)
  assert.equal(calls, 0)
})

test('pre-cancelled requests contact neither provider', async () => {
  const controller = new AbortController(); controller.abort()
  let calls = 0
  const generate = createAIClient({ env, warn: silent, claude: async () => { calls++ }, groq: async () => { calls++ } })
  await assert.rejects(generate(options, { signal: controller.signal }), { name: 'AbortError' })
  assert.equal(calls, 0)
})

test('missing Claude key uses Groq directly and warns only once', async () => {
  let calls = 0; let warnings = 0
  const generate = createAIClient({ env: { GROQ_API_KEY: 'test-groq-key' }, warn: () => { warnings++ }, claude: async () => assert.fail('Claude must not be called'), groq: async () => { calls++; return groqAnswer() } })
  await generate(options); await generate(options)
  assert.equal(calls, 2)
  assert.equal(warnings, 1)
})

test('a working Claude key does not require a Groq key', async () => {
  const generate = createAIClient({ env: { CLAUDE_API_KEY: 'test' }, warn: silent, claude: async () => claudeAnswer() })
  assert.deepEqual(await generate(options), { ok: true })
})

test('missing both keys and double failures return sanitized errors', async () => {
  const missing = createAIClient({ env: {}, warn: silent })
  await assert.rejects(missing(options), /Configure CLAUDE_API_KEY or GROQ_API_KEY/)
  const generate = createAIClient({ env, warn: silent, claude: async () => { throw new Error('secret test-claude-key') }, groq: async () => { throw new Error('secret test-groq-key') } })
  await assert.rejects(generate(options), error => !error.message.includes('test-') && /unavailable/.test(error.message))
})

test('Groq validation repair remains available to the judge', async () => {
  let calls = 0
  const generate = createAIClient({ env: { GROQ_API_KEY: 'test' }, warn: silent, groq: async (body) => {
    calls++
    if (calls === 2) assert.match(body.messages.at(-1).content, /valid JSON/)
    return calls === 1 ? groqAnswer('invalid') : groqAnswer()
  } })
  assert.deepEqual(await generate({ ...options, fallbackValidationRetries: 1 }), { ok: true })
  assert.equal(calls, 2)
})

test('both attempts respect the shared deadline, even for stalled transports', async () => {
  const signals = []
  const stalled = (_, request) => { signals.push(request.signal); return new Promise(() => {}) }
  const generate = createAIClient({ env, warn: silent, claude: stalled, groq: stalled })
  const start = Date.now()
  await assert.rejects(generate(options, { timeout: 100 }), { name: 'APIConnectionTimeoutError' })
  assert.ok(Date.now() - start < 500)
  assert.equal(signals.length, 2)
  assert.ok(signals.every(signal => signal.aborted))
})

test('cancellation during fallback stops Groq too', async () => {
  const controller = new AbortController()
  let groqSignal
  const generate = createAIClient({ env, warn: silent, claude: async () => { throw new Error('unavailable') }, groq: (_, request) => { groqSignal = request.signal; return new Promise(() => {}) } })
  const pending = generate(options, { signal: controller.signal })
  await wait(5)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.ok(groqSignal.aborted)
})
