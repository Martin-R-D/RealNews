const { createAIClient } = require('../ai/client')

async function main() {
  if (!process.env.CLAUDE_API_KEY?.trim()) throw new Error('Set CLAUDE_API_KEY in server/.env or the server environment first.')
  let usedFallback = false
  const generateJSON = createAIClient({ warn(message) { usedFallback = true; console.warn(message) } })
  const started = Date.now()
  await generateJSON({
    messages: [{ role: 'user', content: 'Return exactly this JSON object: {"ok":true}' }],
    maxTokens: 256,
    validate(data) { if (data.ok !== true) throw new Error('Invalid test response'); return data },
  }, { timeout: 15000 })
  if (usedFallback) throw new Error('Groq fallback worked, but the Claude request did not succeed. Check the Claude key, model access, and API hostname/network policy.')
  console.log(`Claude Haiku 5.5 at low effort verified (${Date.now() - started}ms). No Groq fallback used.`)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
