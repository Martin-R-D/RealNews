require('dotenv').config()

const Groq = require('groq-sdk')
const { parseJson } = require('./parseJson')
const { SOURCES } = require('../fetchers/rssFetcher')

async function orchestrate(topic) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    messages: [
      {
        role: 'user',
        content: [
          'You are a news analysis orchestrator. Given a topic and a list of news sources, select the 5 most geographically and editorially diverse sources that would provide the best coverage of this topic. Prioritize sources from regions directly involved in or most affected by the topic.',
          `Topic: ${topic}`,
          `Available sources: ${SOURCES.map((source) => source.name).join(', ')}`,
          'Also generate 3 specific search queries for this topic.',
          'Return ONLY valid JSON in this exact format with no explanation: {"selectedSources":["source1","source2","source3","source4","source5"],"searchQueries":["query1","query2","query3"]}',
        ].join(' '),
      },
    ],
  })

  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('Groq returned an empty response')
  }

  const result = parseJson(content)
  const available = new Set(SOURCES.map((source) => source.name))
  const selectedSources = result.selectedSources
  const searchQueries = result.searchQueries
  if (
    !Array.isArray(selectedSources) ||
    selectedSources.length !== 5 ||
    selectedSources.some((source) => !available.has(source)) ||
    !Array.isArray(searchQueries) ||
    searchQueries.length !== 3 ||
    searchQueries.some((query) => typeof query !== 'string')
  ) {
    throw new Error('Groq response did not contain 5 valid sources and 3 queries')
  }

  return { selectedSources, searchQueries }
}

module.exports = { orchestrate }
