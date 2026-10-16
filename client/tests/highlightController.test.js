import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as wait } from 'node:timers/promises'
import { createHighlightController } from '../src/hooks/highlightController.js'
const popup = (text = 'This is a selected sentence for analysis.') => ({ text, sourceName: 'A', articleId: 0 })
const answer = { biasScore: 20, neutralVersion: 'Neutral.', howOthersSaidIt: [] }
const response = (result = answer) => ({ ok: true, json: async () => result })
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r }); return { promise, resolve } }

test('deduplicates an active selection and serves repeat selections from cache', async () => {
  let calls = 0
  const pending = deferred()
  const controller = createHighlightController([], { delay: 0, request: async () => { calls++; return pending.promise } })
  controller.open(popup())
  await wait(5)
  controller.open({ ...popup(), range: 'new-position' })
  assert.equal(calls, 1)
  pending.resolve(response())
  await wait(5)
  assert.equal(controller.getSnapshot().result, answer)
  controller.close()
  controller.open(popup())
  assert.equal(controller.getSnapshot().loading, false)
  assert.equal(controller.getSnapshot().result, answer)
  assert.equal(calls, 1)
  controller.close()
})

test('stale completion cannot replace a newer result or clear its loading state', async () => {
  const first = deferred(); const second = deferred()
  const signals = []
  const controller = createHighlightController([], { delay: 0, request: (_, options) => {
    signals.push(options.signal)
    return signals.length === 1 ? first.promise : second.promise
  } })
  controller.open(popup())
  await wait(5)
  controller.open(popup('A different sentence for another request.'))
  await wait(5)
  assert.equal(signals[0].aborted, true)
  first.resolve(response({ ...answer, neutralVersion: 'Old' }))
  await wait(5)
  assert.equal(controller.getSnapshot().loading, true)
  assert.equal(controller.getSnapshot().result, null)
  second.resolve(response())
  await wait(5)
  assert.equal(controller.getSnapshot().result, answer)
  controller.close()
})

test('rapid selections debounce; close prevents pending work and ignores late results', async () => {
  let calls = 0
  const pending = deferred()
  const controller = createHighlightController([], { delay: 10, request: async () => { calls++; return pending.promise } })
  controller.open(popup())
  controller.open(popup('Another selection before the debounce expires.'))
  await wait(20)
  assert.equal(calls, 1)
  controller.close()
  pending.resolve(response())
  await wait(5)
  assert.equal(controller.getSnapshot().popup, null)
  controller.open(popup())
  controller.close()
  await wait(20)
  assert.equal(calls, 1)
})

test('timeout stays visible and retry recovers without a stale request replacing it', async () => {
  let calls = 0
  let signal
  const controller = createHighlightController([], { delay: 0, timeout: 15, request: async (_, options) => {
    calls++
    signal = options.signal
    return calls === 1 ? new Promise(() => {}) : response()
  } })
  controller.open(popup())
  await wait(35)
  assert.equal(signal.aborted, true)
  assert.ok(controller.getSnapshot().popup)
  assert.match(controller.getSnapshot().error, /too long/)
  assert.equal(controller.getSnapshot().loading, false)
  controller.retry()
  await wait(5)
  assert.equal(controller.getSnapshot().result, answer)
  assert.equal(controller.getSnapshot().error, '')
  controller.close()
})

test('API errors remain visible and can be retried', async () => {
  let calls = 0
  const controller = createHighlightController([], { delay: 0, request: async () => ++calls === 1
    ? { ok: false, json: async () => ({ error: 'Please retry.' }) } : response() })
  controller.open(popup())
  await wait(5)
  assert.equal(controller.getSnapshot().error, 'Please retry.')
  controller.retry()
  await wait(5)
  assert.equal(controller.getSnapshot().result, answer)
  controller.close()
})
