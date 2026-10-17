const path = require('node:path')
const axios = require('axios')
const Groq = require('groq-sdk')
const { parseJson } = require('../agents/parseJson')

// Resolve server/.env independently of the directory used to start Node.
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })

const CLAUDE_MODEL = 'claude-haiku-5-5'
const GROQ_MODEL = 'openai/gpt-oss-20b'
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages'

class InvalidAIResponse extends Error {}
function timeoutError() {
  const error = new Error('AI request timed out. Please try again.')
  error.name = 'APIConnectionTimeoutError'
  return error
}
function abortError() {
  const error = new Error('AI request cancelled')
  error.name = 'AbortError'
  return error
}
function checkCancelled(signal) { if (signal?.aborted) throw abortError() }

// Enforce the deadline even if a transport fails to settle after cancellation.
async function boundedRequest(operation, { signal, timeout }) {
  checkCancelled(signal)
  if (timeout <= 0) throw timeoutError()
  const controller = new AbortController()
  let rejectAbort
  const cancellation = new Promise((_, reject) => { rejectAbort = reject })
  const abort = () => { rejectAbort(abortError()); controller.abort() }
  const timer = setTimeout(() => { rejectAbort(timeoutError()); controller.abort() }, timeout)
  signal?.addEventListener('abort', abort, { once: true })
  try {
    return await Promise.race([Promise.resolve().then(() => { checkCancelled(controller.signal); return operation({ signal: controller.signal, timeout }) }), cancellation])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

async function requestClaude(body, { apiKey, signal, timeout }) {
  const response = await axios.post(CLAUDE_URL, body, {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    signal, timeout,
  })
  return response.data
}

async function requestGroq(body, { apiKey, signal, timeout }) {
  const groq = new Groq({ apiKey })
  return groq.chat.completions.create(body, { signal, timeout, maxRetries: 0 })
}

function decode(text, validate) {
  try {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Empty response')
    const parsed = parseJson(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object')
    return validate(parsed)
  } catch { throw new InvalidAIResponse('AI returned an invalid response') }
}

function createAIClient({ env = process.env, claude = requestClaude, groq = requestGroq, warn = (message) => console.warn(message) } = {}) {
  let warnedMissingKey = false
  return async function generateJSON({ messages, maxTokens = 1800, temperature, jsonMode = false, validate = (data) => data, fallbackValidationRetries = 0 }, { signal, timeout = 45000 } = {}) {
    checkCancelled(signal)
    const deadline = Date.now() + timeout
    if (env.CLAUDE_API_KEY?.trim()) {
      const system = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n')
      const body = {
        model: CLAUDE_MODEL,
        // Haiku's token cap includes adaptive thinking as well as visible JSON.
        max_tokens: Math.max(2048, maxTokens * 2),
        output_config: { effort: 'low' },
        system: `${system}${system ? '\n\n' : ''}Return only the requested JSON object, without markdown or commentary.`,
        messages: messages.filter((message) => message.role !== 'system'),
      }
      try {
        const response = await boundedRequest((options) => claude(body, { ...options, apiKey: env.CLAUDE_API_KEY }), { signal, timeout: Math.max(1, Math.floor(timeout * 0.6)) })
        checkCancelled(signal)
        if (!response || response.type === 'error' || response.stop_reason !== 'end_turn') throw new InvalidAIResponse('Incomplete Claude response')
        const text = response.content?.filter((block) => block.type === 'text').map((block) => block.text).join('')
        return decode(text, validate)
      } catch (error) {
        checkCancelled(signal)
        // Do not log provider error bodies, prompts, headers, or credentials.
        const reason = error instanceof InvalidAIResponse ? 'invalid response' : error.name === 'APIConnectionTimeoutError' || error.code === 'ECONNABORTED' ? 'timeout' : 'request failed'
        warn(`[ai] Claude ${reason}; using Groq fallback.`)
      }
    } else if (!warnedMissingKey) {
      warnedMissingKey = true
      warn('[ai] CLAUDE_API_KEY is not configured; using Groq fallback.')
    }

    checkCancelled(signal)
    if (!env.GROQ_API_KEY?.trim()) throw new Error('AI is unavailable. Configure CLAUDE_API_KEY or GROQ_API_KEY on the server.')
    for (let attempt = 0; attempt <= fallbackValidationRetries; attempt++) {
      try {
        const response = await boundedRequest((options) => groq({
          model: GROQ_MODEL,
          messages: attempt ? [...messages, { role: 'user', content: 'Return only valid JSON without markdown fences. Follow the requested schema exactly.' }] : messages,
          max_tokens: maxTokens,
          ...(temperature == null ? {} : { temperature }),
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }, { ...options, apiKey: env.GROQ_API_KEY }), { signal, timeout: deadline - Date.now() })
        checkCancelled(signal)
        if (response.choices?.[0]?.finish_reason && response.choices[0].finish_reason !== 'stop') throw new InvalidAIResponse('Incomplete Groq response')
        return decode(response.choices?.[0]?.message?.content, validate)
      } catch (error) {
        checkCancelled(signal)
        if (error instanceof InvalidAIResponse && attempt < fallbackValidationRetries) continue
        if (error.name === 'APIConnectionTimeoutError') throw timeoutError()
        throw new Error('AI providers are unavailable or returned an invalid response. Please try again.')
      }
    }
  }
}

const generateJSON = createAIClient()
module.exports = { generateJSON, createAIClient, CLAUDE_MODEL, GROQ_MODEL }
