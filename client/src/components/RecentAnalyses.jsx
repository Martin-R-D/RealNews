import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowIcon } from './AppHeader'

export default function RecentAnalyses() {
  const [history, setHistory] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('realnews_history') || '[]')
      return Array.isArray(saved) ? saved : []
    } catch { return [] }
  })
  const navigate = useNavigate()

  function removeAnalysis(analyzedAt) {
    const next = history.filter((entry) => entry.analyzedAt !== analyzedAt)
    setHistory(next)
    try { localStorage.setItem('realnews_history', JSON.stringify(next)) } catch { /* The library remains usable when storage is full. */ }
  }

  return <section id="recent-analyses" aria-labelledby="library-heading" className="library-section app-container">
    <div className="section-title-row">
      <div><p className="section-kicker">PICK UP WHERE YOU LEFT OFF</p><h2 id="library-heading" className="section-title">Your reading room<span>.</span></h2></div>
      <span className="subtle-label">{history.length ? `${history.length} saved ${history.length === 1 ? 'analysis' : 'analyses'}` : 'Made for a second look'}</span>
    </div>
    {!history.length ? <div className="library-empty"><span className="library-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 5h6a3 3 0 0 1 3 3v13a4 4 0 0 0-4-3H4V5Zm9 3a3 3 0 0 1 3-3h5v13h-4a4 4 0 0 0-4 3" /></svg></span><div><h3>A little space for the bigger picture.</h3><p>Your analyses will appear here, ready whenever you want to revisit a story.</p></div></div> :
      <div className="library-grid">{history.map((entry) => <article key={entry.analyzedAt} className="library-card">
        <button type="button" className="library-open" onClick={() => navigate('/results', { state: { topic: entry.topic, cachedResults: entry.results } })}>
          <span className="library-date">{new Date(entry.analyzedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} <ArrowIcon /></span>
          <strong>{entry.topic}</strong>
          <span className="library-stats">{entry.stats?.totalSources ?? 0} sources <span>·</span> {entry.stats?.totalArticles ?? 0} articles</span>
        </button>
        <div className="library-card-footer"><span>Saved on this device</span><button type="button" onClick={() => removeAnalysis(entry.analyzedAt)} aria-label={`Delete ${entry.topic}`}>Delete</button></div>
      </article>)}</div>}
  </section>
}
