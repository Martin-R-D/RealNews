require('dotenv').config()

const cors = require('cors')
const express = require('express')
const { analyze } = require('./agents/analyst')
const { judge } = require('./agents/judge')
const { orchestrate } = require('./agents/orchestrator')
const { fetchGuardian } = require('./fetchers/guardianFetcher')
const { fetchNYT } = require('./fetchers/nytFetcher')
const { fetchRSS, RSS_SOURCES } = require('./fetchers/rssFetcher')

const app = express()
const port = 3001

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/analyze', async (req, res) => {
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
    const fetchers = [
      ['BBC', () => fetchRSS('BBC', RSS_SOURCES.BBC, query)],
      ['Al Jazeera', () => fetchRSS('Al Jazeera', RSS_SOURCES['Al Jazeera'], query)],
      ['Fox News', () => fetchRSS('Fox News', RSS_SOURCES['Fox News'], query)],
      ['The Guardian', () => fetchGuardian(query)],
      ['New York Times', () => fetchNYT(query)],
    ]
    fetchers.forEach(([source]) => send({ agent: source, status: 'active' }))

    const results = await Promise.all(
      fetchers.map(async ([source, fetcher]) => {
        const articles = await fetcher()
        send({ agent: source, status: 'done', articlesFound: articles.length })
        return articles
      }),
    )
    const articles = results.flat()

    send({
      agent: 'analyst',
      status: 'active',
      message: 'Comparing sources...',
    })
    const analysis = await analyze(articles)
    send({ agent: 'analyst', status: 'done' })

    send({
      agent: 'judge',
      status: 'active',
      message: 'Generating verdict...',
    })
    const verdict = await judge(articles, analysis)
    send({ agent: 'judge', status: 'done' })
    send({
      type: 'result',
      data: { topic, queries, articles, analysis, verdict },
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
