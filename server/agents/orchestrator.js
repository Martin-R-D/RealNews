require('dotenv').config()

const { generateJSON } = require('../ai/client')
const { SOURCES } = require('../fetchers/rssFetcher')

async function orchestrate(topic) {
  return generateJSON({
    maxTokens: 1200,
    validate: validateOrchestration,
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
}

function validateOrchestration(result) {
  const available = new Set(SOURCES.map((source) => source.name))
  const selectedSources = result.selectedSources
  const searchQueries = result.searchQueries
  if (
    !Array.isArray(selectedSources) ||
    selectedSources.length !== 5 ||
    new Set(selectedSources).size !== 5 ||
    selectedSources.some((source) => !available.has(source)) ||
    !Array.isArray(searchQueries) ||
    searchQueries.length !== 3 ||
    searchQueries.some((query) => typeof query !== 'string' || !query.trim())
  ) {
    throw new Error('AI response did not contain 5 valid sources and 3 queries')
  }

  return { selectedSources, searchQueries }
}

module.exports = { orchestrate }
