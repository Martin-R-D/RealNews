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
      <main className="min-h-screen bg-[#F8F9FB] px-6 py-10 text-[#0F1117]">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-8 text-3xl font-bold text-[#0F1117]">Analyzing: {topic}</h1>
          <AgentPipeline events={events} />
        </div>
      </main>
    )
  }

  if (error) {
    return     <main className="min-h-screen bg-[#F8F9FB] p-6 text-[#DC2626]">{error}</main>
  }

  return (
    <main className="min-h-screen bg-[#F8F9FB] px-6 py-10 text-[#0F1117]">
      <div className="mx-auto max-w-6xl space-y-8">
        {result?.heroImage && (
          <div className="relative h-[320px] overflow-hidden rounded-2xl">
            <img src={result.heroImage} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-8 pt-24">
              <h1 className="font-['Playfair_Display'] text-4xl font-semibold text-white">
                {topic}
              </h1>
            </div>
          </div>
        )}
        <header>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-6 text-sm text-[#6B7280] transition hover:text-[#2563EB]"
          >
            ← Back to home
          </button>
          <p className="text-sm font-medium text-[#6B7280]">
            RealNews analysis
          </p>
          <h1 className="mt-2 text-3xl font-bold">{topic}</h1>
        </header>

        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat value={result?.totalArticles ?? 0} label="Articles Analyzed" />
            <Stat value={result?.totalSources ?? 0} label="Sources Compared" />
            <Stat value={result?.durationSeconds ?? '0.0'} label="Seconds" />
          </div>
        </section>

        <section className="rounded-2xl border border-[#E8EAF0] border-l-4 border-l-[#2563EB] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]">
          <h2 className="text-sm font-medium text-[#6B7280]">
            Neutral Summary
          </h2>
          <p className="mt-4 text-xl leading-9 text-[#0F1117]">
            {result?.verdict?.neutralSummary || result?.neutralSummary}
          </p>
        </section>

        <BiasSpectrum analysis={result?.verdict?.sources || []} />

        <section>
          <h2 className="mb-4 text-2xl font-bold">Source Cards</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(result?.verdict?.sources || []).map((item) => (
              <article
                key={item.source}
                className="rounded-2xl border border-[#E8EAF0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-[#0F1117]">{item.source}</h3>
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${biasClass(item.biasScore)}`}>
                    {item.biasScore}/100
                  </span>
                </div>
                <div className="mt-5">
                  <p className="text-xs font-medium text-[#6B7280]">
                    Emotional language
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(item.emotionalLanguage || []).map((word) => (
                      <span
                        key={word}
                        className="rounded-lg bg-[#FEF2F2] px-2.5 py-1 text-sm text-[#DC2626]"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-5">
                  <p className="text-xs font-medium text-[#6B7280]">
                    Emphasis
                  </p>
                  <p className="mt-2 leading-7 text-[#6B7280]">{item.emphasis}</p>
                </div>
                <div className="mt-5 border-t border-[#E8EAF0] pt-5">
                  <p className="text-xs font-medium text-[#6B7280]">Omissions</p>
                  <p className="mt-2 leading-7 text-[#6B7280]">{item.omissions}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E8EAF0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]">
          <h2 className="text-2xl font-bold">Common Facts</h2>
          <ul className="mt-4 space-y-3 text-[#6B7280]">
            {(result?.verdict?.commonFacts || result?.commonFacts || []).map(
              (fact) => (
                <li key={fact} className="flex gap-3 leading-7">
                  <span className="text-[#2563EB]">✓</span>
                  <span>{fact}</span>
                </li>
              ),
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-[#FDE68A] border-l-4 border-l-[#F59E0B] bg-[#FFFBEB] p-6">
          <h2 className="text-2xl font-bold text-[#92400E]">
            Missing Context
          </h2>
          <p className="mt-3 leading-7 text-[#92400E]">
            {result?.verdict?.missingContext || result?.missingContext}
          </p>
        </section>
      </div>
    </main>
  )
}

function Stat({ value, label }) {
  return (
    <div className="rounded-2xl border border-[#E8EAF0] bg-white p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]">
      <div className="text-3xl font-bold text-[#0F1117]">{value}</div>
      <div className="mt-1 text-xs font-medium text-[#6B7280]">
        {label}
      </div>
    </div>
  )
}

function BiasSpectrum({ analysis }) {
  return (
    <section className="rounded-2xl border border-[#E8EAF0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Bias Spectrum</h2>
        <span className="text-sm text-[#6B7280]">Left to Right</span>
      </div>
      <div className="relative mt-12 px-1">
        <div className="h-2 rounded-full bg-gradient-to-r from-[#DC2626] via-[#16A34A] to-[#EA580C]" />
        {analysis.map((item) => (
          <span
            key={item.source}
            title={`${item.source}: ${item.biasScore}`}
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#2563EB] shadow-lg"
            style={{ left: `${Math.min(100, Math.max(0, item.biasScore))}%` }}
          />
        ))}
      </div>
      <div className="mt-4 flex justify-between text-xs text-[#6B7280]">
        <span>Left</span>
        <span>Center</span>
        <span>Right</span>
      </div>
    </section>
  )
}

function biasClass(score) {
  if (score < 40) return 'bg-[#FEF2F2] text-[#DC2626]'
  if (score > 60) return 'bg-[#FFF7ED] text-[#EA580C]'
  return 'bg-[#F0FDF4] text-[#16A34A]'
}
