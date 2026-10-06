import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function RecentAnalyses() {
  const [history, setHistory] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem('realnews_history') || '[]'))
    } catch {
      setHistory([])
    }
  }, [])

  if (!history.length) return null

  return (
    <section className="mx-auto max-w-6xl pb-8">
      <h2 className="text-2xl font-semibold">Recently Analyzed</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {history.map((entry) => {
          const date = new Date(entry.analyzedAt)
          return (
            <button
              key={entry.analyzedAt}
              type="button"
              onClick={() =>
                navigate('/results', {
                  state: { topic: entry.topic, cachedResults: entry.results },
                })
              }
              className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-cyan-400"
            >
              <strong className="block text-slate-100">{entry.topic}</strong>
              <span className="mt-2 block text-xs text-slate-400">
                Analyzed on {date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                at {date.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </span>
              <span className="mt-3 block text-sm text-slate-500">
                {entry.stats.totalSources} sources · {entry.stats.totalArticles} articles
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
