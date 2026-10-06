import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AgentPipeline from '../components/AgentPipeline.jsx'

function parseEvents(buffer) {
  const parts = buffer.split('\n\n')
  return {
    events: parts.slice(0, -1).flatMap((part) => {
      const data = part
        .split('\n')
        .find((line) => line.startsWith('data: '))
        ?.slice(6)
      if (!data) return []
      try {
        return [JSON.parse(data)]
      } catch {
        return []
      }
    }),
    remainder: parts.at(-1),
  }
}

export default function ResultsPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const topic = state?.topic || ''
  const [events, setEvents] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (state?.cachedResults) {
      setResult(state.cachedResults)
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()

    async function analyzeTopic() {
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic }),
          signal: controller.signal,
        })
        if (!response.ok || !response.body) {
          throw new Error('Unable to connect to the analysis server')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
          const parsed = parseEvents(buffer)
          buffer = parsed.remainder
          parsed.events.forEach((event) => {
            if (event.type === 'result') {
              setResult(event.data)
              setLoading(false)
              try {
                const history = JSON.parse(
                  localStorage.getItem('realnews_history') || '[]',
                )
                const entry = {
                  topic,
                  analyzedAt: new Date().toISOString(),
                  results: event.data,
                  stats: {
                    totalArticles: event.data.totalArticles,
                    totalSources: event.data.totalSources,
                    durationSeconds: event.data.durationSeconds,
                  },
                }
                localStorage.setItem(
                  'realnews_history',
                  JSON.stringify([entry, ...history].slice(0, 8)),
                )
              } catch {
                // Storage may be unavailable or contain invalid data.
              }
            } else if (event.error) {
              setError(event.error)
              setLoading(false)
            } else {
              setEvents((current) => [...current, event])
            }
          })
          if (done) break
        }
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message)
          setLoading(false)
        }
      }
    }

    analyzeTopic()
    return () => controller.abort()
  }, [topic])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-8 text-3xl font-bold">Analyzing: {topic}</h1>
          <AgentPipeline events={events} />
        </div>
      </main>
    )
  }

  if (error) {
    return <main className="min-h-screen bg-slate-950 p-6 text-red-300">{error}</main>
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-6 text-sm text-slate-400 transition hover:text-cyan-400"
          >
            ← Back to home
          </button>
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
            RealNews analysis
          </p>
          <h1 className="mt-2 text-3xl font-bold">{topic}</h1>
        </header>

        <section className="rounded-2xl bg-gradient-to-r from-cyan-400/60 via-blue-500/60 to-purple-500/60 p-px shadow-lg shadow-cyan-950/30">
          <div className="grid grid-cols-3 rounded-2xl bg-slate-900 p-5 text-center">
            <Stat value={result?.totalArticles ?? 0} label="Articles Analyzed" />
            <Stat value={result?.totalSources ?? 0} label="Sources Compared" />
            <Stat value={result?.durationSeconds ?? '0.0'} label="Seconds" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Neutral Summary
          </h2>
          <p className="mt-4 text-xl leading-9 text-slate-100">
            {result?.verdict?.neutralSummary || result?.neutralSummary}
          </p>
        </section>

        <BiasSpectrum analysis={result?.verdict?.sources || []} />

        <section>
          <h2 className="mb-4 text-2xl font-semibold">Source Cards</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(result?.verdict?.sources || []).map((item) => (
              <article
                key={item.source}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{item.source}</h3>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-cyan-300">
                    {item.biasScore}/100
                  </span>
                </div>
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Emotional language
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(item.emotionalLanguage || []).map((word) => (
                      <span
                        key={word}
                        className="rounded-full bg-red-400/10 px-2.5 py-1 text-sm text-red-300"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Emphasis
                  </p>
                  <p className="mt-2 leading-7 text-slate-300">{item.emphasis}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-2xl font-semibold">Common Facts</h2>
          <ul className="mt-4 space-y-3 text-slate-300">
            {(result?.verdict?.commonFacts || result?.commonFacts || []).map(
              (fact) => (
                <li key={fact} className="flex gap-3 leading-7">
                  <span className="text-cyan-400">•</span>
                  <span>{fact}</span>
                </li>
              ),
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-6">
          <h2 className="text-2xl font-semibold text-yellow-200">
            Missing Context
          </h2>
          <p className="mt-3 leading-7 text-yellow-100/80">
            {result?.verdict?.missingContext || result?.missingContext}
          </p>
        </section>
      </div>
    </main>
  )
}

function Stat({ value, label }) {
  return (
    <div className="border-slate-800 px-3 first:border-r last:border-l">
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  )
}

function BiasSpectrum({ analysis }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Bias Spectrum</h2>
        <span className="text-sm text-slate-400">Left to Right</span>
      </div>
      <div className="relative mt-12 px-1">
        <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 via-slate-400 to-red-500" />
        {analysis.map((item) => (
          <span
            key={item.source}
            title={`${item.source}: ${item.biasScore}`}
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-white shadow-lg"
            style={{ left: `${Math.min(100, Math.max(0, item.biasScore))}%` }}
          />
        ))}
      </div>
      <div className="mt-4 flex justify-between text-xs text-slate-500">
        <span>Left</span>
        <span>Center</span>
        <span>Right</span>
      </div>
    </section>
  )
}
