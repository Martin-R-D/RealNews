require('dotenv').config()

const Groq = require('groq-sdk')
const { parseJson } = require('./parseJson')

async function judge(articles) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const input = articles.map(({ source, title, content }) => ({
    source,
    title,
    content,
  }))
  const prompt = `Return only valid JSON in this shape: {"sources":[{"source":"","biasScore":50,"emotionalLanguage":[],"emphasis":"","omissions":""}],"neutralSummary":"","commonFacts":[],"missingContext":"","overallBiasSpread":""}. Analyze these articles briefly. Use one short sentence per string, at most 3 commonFacts and 3 emotionalLanguage words. ${JSON.stringify(input)}`

  for (const retryPrompt of [prompt, `${prompt} Do not use markdown fences.`]) {
    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'user', content: retryPrompt }],
      max_tokens: 1800,
    })
    try {
      return parseJson(response.choices[0]?.message?.content || '')
    } catch (error) {
      if (retryPrompt === prompt) continue
      throw new Error(`Groq returned invalid JSON: ${error.message}`)
    }
  }
}

module.exports = { judge }
