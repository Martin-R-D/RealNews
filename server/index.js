require('dotenv').config()

const cors = require('cors')
const express = require('express')
const { judge } = require('./agents/judge')
const { orchestrate } = require('./agents/orchestrator')
const { fetchGuardian } = require('./fetchers/guardianFetcher')
const { fetchNYT } = require('./fetchers/nytFetcher')
const { fetchTopStories } = require('./fetchers/nytTopStories')
const { fetchRSS, RSS_SOURCES } = require('./fetchers/rssFetcher')

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
    const queries = await orchestrate(topic)
    send({ agent: 'orchestrator', status: 'done' })

    const query = queries.join(' OR ')
    const fetchRSSQueries = (source, url) =>
      Promise.all(queries.map((item) => fetchRSS(source, url, item))).then(
        (groups) =>
          [...new Map(groups.flat().map((article) => [article.url, article])).values()].slice(
            0,
            3,
          ),
      )
    const fetchers = [
      ['BBC', () => fetchRSSQueries('BBC', RSS_SOURCES.BBC)],
      ['Al Jazeera', () => fetchRSSQueries('Al Jazeera', RSS_SOURCES['Al Jazeera'])],
      ['Fox News', () => fetchRSSQueries('Fox News', RSS_SOURCES['Fox News'])],
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

    send({
      agent: 'judge',
      status: 'active',
      message: 'Generating verdict...',
    })
    const verdict = await judge(articles)
    send({ agent: 'judge', status: 'done' })
    send({
      type: 'result',
      data: {
        topic,
        queries,
        articles,
        verdict,
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

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
