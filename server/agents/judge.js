require('dotenv').config()

const { generateJSON } = require('../ai/client')

async function judge(articles) {
  const input = articles.map(({ source, title, contentShort }) => ({
    source,
    title,
    content: contentShort,
  }))
  const sourceNames = [...new Set(articles.map((article) => article.source))]
  const prompt = `Return only valid JSON in this shape: {"sources":[{"source":"SOURCE_NAME","biasScore":NUMBER_0_TO_100,"emotionalLanguage":[],"emphasis":"","omissions":""}],"neutralSummary":"","commonFacts":[],"missingContext":"","overallBiasSpread":""}. Return exactly one sources item for each of these source names: ${sourceNames.join(', ')}. Assess each biasScore independently from that source's wording, framing, emphasis, and omissions; do not use 50 as a default. Use one short sentence per string, at most 3 commonFacts and 3 emotionalLanguage words. ${JSON.stringify(input)}`

  return generateJSON({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1800,
    fallbackValidationRetries: 1,
    validate(data) {
      if (!Array.isArray(data.sources) || data.sources.length !== sourceNames.length ||
        new Set(data.sources.map((item) => item?.source)).size !== sourceNames.length ||
        data.sources.some((item) => !sourceNames.includes(item?.source) || !Number.isFinite(item.biasScore) || item.biasScore < 0 || item.biasScore > 100 ||
          !Array.isArray(item.emotionalLanguage) || item.emotionalLanguage.some((word) => typeof word !== 'string') || typeof item.emphasis !== 'string' || typeof item.omissions !== 'string') ||
        typeof data.neutralSummary !== 'string' || !Array.isArray(data.commonFacts) || data.commonFacts.some((fact) => typeof fact !== 'string') ||
        typeof data.missingContext !== 'string' || typeof data.overallBiasSpread !== 'string') throw new Error('Invalid verdict')
      return data
    },
  })
}

module.exports = { judge }
