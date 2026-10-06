require('dotenv').config()

const Groq = require('groq-sdk')
const { parseJson } = require('./parseJson')

async function judge(articles) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const response = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    messages: [{
      role: 'user',
      content: `Analyze these news articles and return ONLY valid JSON, with no explanation before or after. Be brief: maximum 2 sentences in every string field. Use this exact structure: {"sources":[{"source":"string","biasScore":0,"emotionalLanguage":["string"],"emphasis":"string","omissions":"string"}],"neutralSummary":"string","commonFacts":["string"],"missingContext":"string","overallBiasSpread":"string"}. biasScore is 0-100, where 0 is far left, 50 is center, and 100 is far right. Articles: ${JSON.stringify(articles)}`,
    }],
  })

  return parseJson(response.choices[0].message.content)
}

module.exports = { judge }
