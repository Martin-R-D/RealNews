require('dotenv').config()

const Groq = require('groq-sdk')

async function orchestrate(topic) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'user',
        content: [
          `Generate exactly 3 specific search queries for the topic: "${topic}".`,
          'The queries should find relevant, current news articles.',
          'Return only a valid JSON array of 3 strings, with no markdown or other text.',
        ].join(' '),
      },
    ],
  })

  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('Groq returned an empty response')
  }

  const queries = JSON.parse(content)
  if (
    !Array.isArray(queries) ||
    queries.length !== 3 ||
    queries.some((query) => typeof query !== 'string')
  ) {
    throw new Error('Groq response was not an array of 3 strings')
  }

  return queries
}

module.exports = { orchestrate }
