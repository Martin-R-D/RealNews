require('dotenv').config()

const Groq = require('groq-sdk')

async function analyze(articles) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'user',
        content: [
          'Given these articles about the same topic from different sources, analyze each source.',
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
  if (
    !Array.isArray(analysis) ||
    analysis.length !== articles.length ||
    analysis.some(
      (item, index) =>
        !item ||
        item.source !== articles[index].source ||
        typeof item.biasScore !== 'number' ||
        !Array.isArray(item.emotionalLanguage) ||
        typeof item.emphasis !== 'string' ||
        typeof item.omissions !== 'string',
    )
  ) {
    throw new Error('Groq response did not match the input sources')
  }

  return analysis
}

module.exports = { analyze }
