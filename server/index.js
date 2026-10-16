require('dotenv').config()

const cors = require('cors')
const express = require('express')
const { prepareHighlight, analyzeHighlight } = require('./agents/highlight')
const { judge } = require('./agents/judge')
const { compareCoverage } = require('./agents/coverage')
const { orchestrate } = require('./agents/orchestrator')
const { fetchGuardian } = require('./fetchers/guardianFetcher')
const { fetchNYT } = require('./fetchers/nytFetcher')
const { fetchTopStories } = require('./fetchers/nytTopStories')
const { getStoryFeed } = require('./services/storyFeed')
const { fetchRSS, SOURCES } = require('./fetchers/rssFetcher')

const app = express()
const port = 3001

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/top-stories', async (req, res) => {
  try {
    res.json(await fetchTopStories(req.query.section || 'home'))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/stories', async (_req, res) => {
  try {
    res.json(await getStoryFeed())
  } catch {
    res.status(503).json({ error: 'The news desk is temporarily unavailable. Please try again.' })
  }
})

app.post('/highlight', async (req, res) => {
  let input
  try {
    input = prepareHighlight(req.body)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
  const controller = new AbortController()
  const disconnect = () => { if (!res.writableEnded) controller.abort() }
  res.on('close', disconnect)
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const result = await analyzeHighlight(input, { signal: controller.signal })
    if (!res.destroyed) res.json(result)
  } catch (error) {
    if (!res.destroyed) {
      const timedOut = controller.signal.aborted || error.name === 'APIConnectionTimeoutError'
      res.status(timedOut ? 504 : 502).json({
        error: timedOut ? 'Analysis took too long. Please try again.' : 'Selection analysis failed. Please try again.',
      })
    }
  } finally {
    clearTimeout(timer)
    res.off('close', disconnect)
  }
})

app.post('/analyze', async (req, res) => {
  const startTime = Date.now()
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`)

  try {
    const topic = req.body.topic
    send({
      agent: 'orchestrator',
      status: 'active',
      message: 'Generating search queries...',
    })
    const { searchQueries, selectedSources } = await orchestrate(topic)
    send({ agent: 'orchestrator', status: 'done', selectedSources })

    const query = searchQueries.join(' OR ')
    const fetchRSSQueries = (source) =>
      Promise.all(searchQueries.map((item) => fetchRSS(source, item))).then(
        (groups) =>
          [...new Map(groups.flat().map((article) => [article.url, article])).values()].slice(
            0,
            3,
          ),
      )
    const fetchers = [
      ...SOURCES.filter((source) => selectedSources.includes(source.name)).map((source) => [
        source.name,
        () => fetchRSSQueries(source),
        source.location,
      ]),
      ['The Guardian', () => fetchGuardian(query)],
      ['New York Times', () => fetchNYT(query)],
    ]
    fetchers.forEach(([source]) => send({ agent: source, status: 'active' }))

    const results = await Promise.all(
      fetchers.map(async ([source, fetcher]) => {
        try {
          const articles = await fetcher()
          send({ agent: source, status: 'done', articlesFound: articles.length })
          return articles
        } catch (error) {
          console.error(`${source} fetch failed:`, error.message)
          send({ agent: source, status: 'error', message: error.message })
          return []
        }
      }),
    )
    console.log(
      'Articles returned by source:',
      fetchers
        .map(([source], index) => `${source}: ${results[index].length}`)
        .join(', '),
    )
    const articles = results.flat()
    const analysisArticles = articles.map(({ source, title, contentShort }) => ({
      source,
      title,
      contentShort,
    }))

    send({
      agent: 'judge',
      status: 'active',
      message: 'Generating verdict...',
    })
    const [verdict, coverage] = await Promise.all([
      judge(analysisArticles),
      compareCoverage(articles).catch((error) => {
        console.error('Coverage comparison failed:', error.message)
        return { status: 'unavailable', findings: [] }
      }),
    ])
    send({ agent: 'judge', status: 'done' })
    send({
      type: 'result',
      data: {
        topic,
        queries: searchQueries,
        selectedSources,
        articles,
        verdict,
        coverage,
        sourceLocations: fetchers
          .filter(([, , location]) => location)
          .map(([source, , location]) => ({ source, location })),
        heroImage: articles.find((article) => article.thumbnail)?.thumbnail || null,
        totalArticles: articles.length,
        totalSources: results.filter((items) => items.length > 0).length,
        durationSeconds: ((Date.now() - startTime) / 1000).toFixed(1),
      },
    })
    res.end()
  } catch (error) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
      res.end()
    }
  }
})

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
  })
}

module.exports = { app }
