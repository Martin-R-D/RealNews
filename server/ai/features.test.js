const { test } = require('node:test')
const assert = require('node:assert/strict')
const shared = require('./client')
let reply
let mode = 'success'
let claudeCalls = 0; let groqCalls = 0
shared.generateJSON = shared.createAIClient({
  env: { CLAUDE_API_KEY: 'test-claude', GROQ_API_KEY: 'test-groq' }, warn: () => {},
  claude: async body => {
    claudeCalls++
    assert.equal(body.model, 'claude-haiku-5-5')
    assert.equal(body.output_config.effort, 'low')
    if (mode === 'failure') throw new Error('Simulated Claude outage')
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(mode === 'invalid' ? {} : reply) }] }
  },
  groq: async body => {
    groqCalls++
    assert.equal(body.model, 'openai/gpt-oss-20b')
    return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply) } }] }
  },
})
const { orchestrate } = require('../agents/orchestrator')
const { judge } = require('../agents/judge')
const { compareCoverage } = require('../agents/coverage')
const { prepareHighlight, analyzeHighlight } = require('../agents/highlight')
const { inferGroups } = require('../services/storyFeed')
const quote = 'A free shuttle bus will run during the bridge closure.'
const articles = [
  { source: 'The Guardian', title: 'Bridge repairs', contentShort: quote, contentFull: quote, abstract: quote, url: 'https://example.com/a' },
  { source: 'BBC', title: 'Bridge repairs', contentShort: quote, contentFull: quote, abstract: quote, url: 'https://example.com/b' },
]
const orchestration = { selectedSources: ['BBC', 'Al Jazeera', 'Reuters', 'Deutsche Welle', 'France 24'], searchQueries: ['bridge repairs', 'bridge closure', 'shuttle service'] }
const verdict = { sources: articles.map(article => ({ source: article.source, biasScore: 10, emotionalLanguage: [], emphasis: 'Repairs.', omissions: 'None identified.' })), neutralSummary: 'Bridge repairs are planned.', commonFacts: ['A shuttle service is planned.'], missingContext: 'The repair cost is unclear.', overallBiasSpread: 'Similar framing.' }
const coverage = { findings: [{ detail: 'Shuttle service', articles: [{ id: 0, status: 'mentioned', quote }, { id: 1, status: 'not_found', quote: '' }] }] }
const highlight = { biasScore: 10, neutralVersion: quote, howOthersSaidIt: [{ articleId: 1, quote }] }
const input = prepareHighlight({ selectedText: quote, sourceName: articles[0].source, selectedArticleId: 0, allArticles: articles })

test('all five features use Claude first and preserve Groq fallback on transport or validation failure', async t => {
  const operations = [
    ['source selection', () => orchestrate('Bridge repairs'), orchestration, value => assert.equal(value.selectedSources.length, 5)],
    ['verdict', () => judge(articles), verdict, value => assert.equal(value.neutralSummary, verdict.neutralSummary)],
    ['coverage', () => compareCoverage(articles), coverage, value => assert.equal(value.findings.length, 1)],
    ['highlight', () => analyzeHighlight(input), highlight, value => assert.equal(value.howOthersSaidIt[0].quote, quote)],
    ['homepage grouping', () => inferGroups(articles), { groups: [[0, 1]] }, value => assert.deepEqual(value, [[0, 1]])],
  ]
  for (const [name, operation, expected, verify] of operations) {
    for (const state of ['success', 'failure', 'invalid']) await t.test(`${name}: ${state}`, async () => {
      mode = state; reply = expected
      const previousClaude = claudeCalls; const previousGroq = groqCalls
      verify(await operation())
      assert.equal(claudeCalls - previousClaude, 1)
      assert.equal(groqCalls - previousGroq, state === 'success' ? 0 : 1)
    })
  }
})
