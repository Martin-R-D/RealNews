require('dotenv').config()

const Groq = require('groq-sdk')

function sourceKey(source) {
  return source.toLowerCase().replace(/[^a-z]/g, '')
}

async function analyze(articles) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const sources = [...new Set(articles.map((article) => article.source))]
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'user',
        content: [
          `Given these articles about the same topic from different sources, analyze each source. Return one object for each source: ${sources.join(', ')}.`,
          'For each source identify biasScore (0-100, 0=far left, 50=center, 100=far right),',
          'emotionalLanguage (an array of loaded words found), emphasis (what this source focuses on),',
          'and omissions (what this source ignores compared to others).',
          'Return only a valid JSON array matching the input sources, with no markdown or other text.',
          `Articles: ${JSON.stringify(articles)}`,
        ].join(' '),
      },
    ],
  })

  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('Groq returned an empty response')
  }

  const analysis = JSON.parse(content)
  const sourceKeys = new Map()
  sources.forEach((source) => {
    sourceKeys.set(sourceKey(source), source)
    if (source === 'The Guardian') sourceKeys.set('guardian', source)
    if (source === 'New York Times') sourceKeys.set('nyt', source)
  })
  if (
    !Array.isArray(analysis) ||
    analysis.length === 0 ||
    analysis.some(
      (item) =>
        !item ||
        !sourceKeys.has(sourceKey(item.source || '')) ||
        Number.isNaN(Number(item.biasScore)) ||
        (!Array.isArray(item.emotionalLanguage) &&
          typeof item.emotionalLanguage !== 'string') ||
        (!Array.isArray(item.emphasis) && typeof item.emphasis !== 'string') ||
        (!Array.isArray(item.omissions) && typeof item.omissions !== 'string'),
    )
  ) {
    throw new Error('Groq response did not match the input sources')
  }

  return analysis.map((item) => ({
    ...item,
    source: sourceKeys.get(sourceKey(item.source)),
    biasScore: Number(item.biasScore),
    emotionalLanguage:
      typeof item.emotionalLanguage === 'string'
        ? [item.emotionalLanguage]
        : item.emotionalLanguage,
    emphasis: Array.isArray(item.emphasis)
      ? item.emphasis.join(' ')
      : item.emphasis,
    omissions: Array.isArray(item.omissions)
      ? item.omissions.join(' ')
      : item.omissions,
  }))
}

module.exports = { analyze }
