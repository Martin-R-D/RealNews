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
    <section className="mx-auto max-w-6xl px-6 pb-12">
      <h2 className="text-2xl font-bold">Recently Analyzed</h2>
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
              className="rounded-2xl border border-[#E8EAF0] border-l-4 border-l-[#2563EB] bg-white p-6 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] transition hover:border-[#2563EB]"
            >
              <strong className="block text-[#0F1117]">{entry.topic}</strong>
              <span className="mt-2 block text-xs text-[#6B7280]">
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
              <span className="mt-3 block text-sm text-[#6B7280]">
                {entry.stats.totalSources} sources · {entry.stats.totalArticles} articles
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
