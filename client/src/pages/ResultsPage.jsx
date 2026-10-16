import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AgentPipeline from '../components/AgentPipeline.jsx'
import HighlightPopup from '../components/HighlightPopup.jsx'
import WorldMap from '../components/WorldMap.jsx'
import CoverageDifferences from '../components/CoverageDifferences.jsx'
import useHighlight from '../hooks/useHighlight'
import AppHeader, { ArrowIcon } from '../components/AppHeader'

const EMPTY_ARTICLES = []

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
  const highlight = useHighlight(result?.articles || EMPTY_ARTICLES)
  const selectedSources =
    events.find((event) => Array.isArray(event.selectedSources))?.selectedSources ||
    result?.sourceLocations ||
    []

  useEffect(() => {
    if (!topic && !state?.cachedResults) return undefined
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

  if (!topic && !state?.cachedResults) {
    return <div className="app-page"><AppHeader report /><main className="app-container state-page"><span className="section-kicker">START WITH A QUESTION</span><h1>What story is on your mind?</h1><p>Choose a story from the news desk, or search for a topic to compare its coverage.</p><button type="button" className="button-primary" onClick={() => navigate('/')}>Explore the news desk <ArrowIcon /></button></main></div>
  }

  if (loading) {
    return <div className="app-page"><AppHeader report /><main className="app-container loading-page">
      <p className="section-kicker">A WIDER VIEW IS TAKING SHAPE</p><h1 className="report-title">Bringing the story<br /><span>into focus.</span></h1>
      <p className="loading-topic">{topic}</p>
      <div className="loading-layout"><AgentPipeline events={events} selectedSources={selectedSources} /><WorldMap events={events} selectedSources={selectedSources} /></div>
      <p className="loading-note">We’re gathering articles, comparing their framing, and checking how the accounts differ.</p>
    </main></div>
  }

  if (error) {
    return <div className="app-page"><AppHeader report /><main className="app-container state-page" role="alert"><span className="section-kicker">LET’S TAKE ANOTHER LOOK</span><h1>The story couldn’t load.</h1><p>{error}</p><button type="button" className="button-primary" onClick={() => navigate('/')}>Back to the news desk <ArrowIcon direction="right" /></button></main></div>
  }

  const sources = result?.verdict?.sources || []
  return <div className="app-page"><AppHeader report />
    <main id="report-content" className="app-container report-page">
      <button type="button" onClick={() => navigate('/')} className="report-back"><ArrowIcon direction="left" /> Back to home</button>
      <header className="report-heading">
        <div><div className="flex flex-wrap items-center gap-3"><p className="section-kicker">THE REALNEWS BRIEFING</p><span className="report-ready"><span /> Analysis complete</span></div><h1 className="report-title">{topic}</h1><p className="report-description">The shared facts. The different angles. A clearer view of the story.</p></div>
        {result?.heroImage && <img src={result.heroImage} alt="" className="report-cover" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
      </header>
      <div className="report-toolbar"><nav aria-label="Analysis sections"><a href="#overview" onClick={scrollToSection}>Overview</a><a href="#coverage" onClick={scrollToSection}>Coverage differences</a><a href="#sources" onClick={scrollToSection}>Source articles</a></nav><span className="subtle-label hidden lg:block">Made for a closer read</span></div>
      <div className="report-metrics"><Stat value={result?.totalArticles ?? 0} label="Articles analyzed" /><Stat value={result?.totalSources ?? 0} label="Sources compared" /><Stat value={`${result?.durationSeconds ?? '0.0'}s`} label="Analysis time" /></div>

      <div id="overview" className="report-overview">
        <div className="report-overview-main">
          <section className="surface summary-panel"><div className="flex items-center justify-between gap-3"><p className="section-kicker">START HERE</p><span className="summary-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 6h14M5 12h14M5 18h9" /></svg></span></div><h2 className="panel-title mt-3">Neutral Summary</h2><p className="neutral-summary">{result?.verdict?.neutralSummary || result?.neutralSummary || 'No summary was returned for this analysis.'}</p><div className="summary-footer"><span /> A starting point. Explore the sources for the full context.</div></section>
          <section className="surface facts-panel"><p className="section-kicker">THE SHARED GROUND</p><h2 className="panel-title mt-2">Common Facts</h2><ul className="common-facts">{(result?.verdict?.commonFacts || result?.commonFacts || []).map((fact) => <li key={fact}><span aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m5 10 3 3 7-7" /></svg></span>{fact}</li>)}</ul>{!(result?.verdict?.commonFacts || result?.commonFacts || []).length && <p className="empty-copy">No shared facts were returned. Read the source articles below.</p>}</section>
        </div>
        <aside className="report-sidebar" aria-label="Source overview"><BiasSpectrum analysis={sources} /><WorldMap events={events} selectedSources={result?.sourceLocations || selectedSources} final /></aside>
      </div>

      <div id="coverage" className="report-section"><CoverageDifferences coverage={result?.coverage} articles={result?.articles || []} /></div>
      <section id="sources" className="report-section"><div className="section-title-row"><div><p className="section-kicker">READ BETWEEN THE HEADLINES</p><h2 className="section-title">The sources, side by side<span>.</span></h2></div><span className="subtle-label">{sources.length} perspectives</span></div><p className="source-hint"><span aria-hidden="true">Aa</span> Select a sentence in an article excerpt to explore its wording and compare it with other sources.</p>
        <div className="source-grid">{sources.map((item, index) => {
          const articleId = result?.articles?.findIndex((candidate) => candidate.source === item.source) ?? -1
          const article = result?.articles?.[articleId]
          const text = article?.contentFull || article?.contentShort
          return <article key={item.source} data-source={item.source} className="surface source-card">
            <header className="source-card-heading"><span className="source-number">{String(index + 1).padStart(2, '0')}</span><h3>{item.source}</h3><span className={`score-pill ${biasClass(item.biasScore)}`} title="Higher scores indicate more loaded wording or framing">{item.biasScore}<span>/100</span></span></header>
            {text && <div className="source-reading"><p className="source-reading-label">ARTICLE EXCERPT</p>{article.title && <h4>{article.title}</h4>}<p data-highlight-source={item.source} data-article-id={articleId} className="source-text">{text}</p>{safeHref(article.url) && <a href={article.url} target="_blank" rel="noopener noreferrer" className="source-original">Read original article <ArrowIcon /></a>}</div>}
            <div className="source-findings"><div><p className="finding-label">Emotional language</p><div className="word-tags">{item.emotionalLanguage?.length ? item.emotionalLanguage.map((word) => <span key={word}>{word}</span>) : <span className="word-tag-empty">None identified</span>}</div></div><div><p className="finding-label">Emphasis</p><p>{item.emphasis || 'No emphasis identified.'}</p></div><div><p className="finding-label">Omissions</p><p>{item.omissions || 'No omissions identified in the available text.'}</p></div></div>
          </article>
        })}</div>{!sources.length && <div className="surface empty-copy">No source assessments were returned for this analysis.</div>}
      </section>
      <section className="context-panel"><span className="context-symbol" aria-hidden="true">i</span><div><p className="section-kicker">KEEP IN MIND</p><h2 className="panel-title mt-2">Missing Context</h2><p>{result?.verdict?.missingContext || result?.missingContext || 'Read the original articles to check the wider context of each account.'}</p></div></section>
      <footer className="report-footer"><span>RealNews. There’s always another perspective.</span><a href="#report-content" onClick={scrollToSection}>Back to top <ArrowIcon /></a></footer>
    </main>{highlight.popup && <HighlightPopup {...highlight} />}
  </div>
}

function scrollToSection(event) {
  event.preventDefault()
  document.getElementById(event.currentTarget.hash.slice(1))?.scrollIntoView({ block: 'start' })
}

function safeHref(value) {
  try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false }
}

function Stat({ value, label }) {
  return <div className="report-stat"><strong>{value}</strong><span>{label}</span></div>
}

function BiasSpectrum({ analysis }) {
  return <section className="surface framing-panel"><p className="section-kicker">A QUICK COMPARISON</p><h2 className="panel-title mt-2">Framing at a glance</h2><p className="framing-description">Loaded wording and emphasis across the available accounts.</p><div className="framing-track" aria-hidden="true" /><div className="framing-labels"><span>Less loaded</span><span>More loaded</span></div><ul className="framing-sources">{analysis.map((item) => <li key={item.source}><span>{item.source}</span><div aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, item.biasScore))}%` }} /></div><strong>{item.biasScore}<span>/100</span></strong></li>)}</ul>{!analysis.length && <p className="empty-copy">No source scores available.</p>}</section>
}

function biasClass(score) {
  if (score < 40) return 'score-low'
  if (score > 60) return 'score-high'
  return 'score-mid'
}
