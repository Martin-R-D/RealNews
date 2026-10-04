require('dotenv').config()

const Groq = require('groq-sdk')
const { parseJson } = require('./parseJson')

async function judge(articles, analysis) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const response = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    messages: [{
      role: 'user',
      content: `Produce a final verdict as JSON with neutralSummary (what actually happened, no spin), commonFacts (array of things all sources agree on), missingContext (important context none or few sources mention), and overallBiasSpread (string describing the range of coverage). Articles: ${JSON.stringify(articles)} Analysis: ${JSON.stringify(analysis)} Return only valid JSON.`,
    }],
  })

  return parseJson(response.choices[0].message.content)
}

module.exports = { judge }
