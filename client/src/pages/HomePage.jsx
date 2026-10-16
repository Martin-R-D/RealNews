import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecentAnalyses from '../components/RecentAnalyses.jsx'
import StoryCard from '../components/StoryCard.jsx'

const topics = ['Climate Change', 'AI Regulation', 'US Elections', 'Ukraine War']

export default function HomePage() {
  const [topic, setTopic] = useState('')
  const [feed, setFeed] = useState(null)
  const [storiesLoading, setStoriesLoading] = useState(true)
  const [storiesError, setStoriesError] = useState('')
  const [filter, setFilter] = useState('all')
  const [attempt, setAttempt] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, 22000)
    async function load() {
      try {
        const response = await fetch('/api/stories', { signal: controller.signal })
        if (!response.ok) throw new Error('The news desk is taking a moment. Please try again.')
        const data = await response.json()
        if (!Array.isArray(data.stories)) throw new Error('Unable to load the news desk.')
        if (!controller.signal.aborted) { setFeed(data); setStoriesLoading(false) }
      } catch (error) {
        if (!controller.signal.aborted || timedOut) {
          setStoriesError(timedOut ? 'The news desk took too long to respond. Please try again.' : error.message)
          setStoriesLoading(false)
        }
      } finally { clearTimeout(timer) }
    }
    load()
    return () => { clearTimeout(timer); controller.abort() }
  }, [attempt])

  function compare(value) {
    if (value.trim()) navigate('/results', { state: { topic: value.trim() } })
  }
  function retry() { setStoriesError(''); setStoriesLoading(true); setAttempt((value) => value + 1) }
  const stories = (feed?.stories || []).filter((story) => filter !== 'multiple' || story.sourceCount > 1)
  const comparedCount = (feed?.stories || []).filter((story) => story.sourceCount > 1).length

  return (
    <main className="news-home min-h-screen text-[#13213b]">
      <nav className="news-nav">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <a href="/" aria-label="RealNews home" className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
            <span className="news-mark" aria-hidden="true">r<span>.</span></span> RealNews<span className="text-[#2563eb]">.</span>
          </a>
          <a href="#news-desk" className="news-nav-link">The news desk <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-3 w-3" aria-hidden="true"><path d="m4 4 8 8M4 12h8V4" /></svg></a>
          <span className="hidden text-xs text-[#7c8596] sm:block">Independent perspectives. One place.</span>
        </div>
      </nav>

      <section className="news-hero mx-auto max-w-7xl px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16">
        <div className="news-eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" /> A LITTLE CONTEXT CHANGES EVERYTHING</div>
        <div className="mt-5 grid grid-cols-1 items-end gap-7 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          <h1 className="news-hero-title">One story.<br /><span>Every perspective.</span></h1>
          <div className="pb-1">
            <p className="max-w-lg text-base leading-7 text-[#69758a]">Headlines tell a story. Comparing them tells you more. Explore the coverage, switch perspectives, and find the bigger picture.</p>
            <form onSubmit={(event) => { event.preventDefault(); compare(topic) }} className="news-search mt-6">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="ml-4 hidden h-5 w-5 shrink-0 text-slate-400 sm:block" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
              <input type="text" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="What story are you curious about?" aria-label="Topic to analyze" className="min-w-0 flex-1 bg-transparent px-4 py-4 text-sm outline-none placeholder:text-[#929bad]" />
              <button type="submit" disabled={!topic.trim()} className="news-search-button">Analyze <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-3 w-3" aria-hidden="true"><path d="m4 12 8-8M4 4h8v8" /></svg></button>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[11px] text-[#929bad]">TRY A TOPIC</span>
              {topics.map((item) => <button key={item} type="button" onClick={() => setTopic(item)} className="news-topic">{item}</button>)}
            </div>
          </div>
        </div>
      </section>

      <section id="news-desk" aria-labelledby="news-desk-heading" className="mx-auto max-w-7xl scroll-mt-6 px-5 pb-16 sm:px-8">
        <div className="news-section-heading">
          <div>
            <div className="news-eyebrow mb-2">THE WORLD, THROUGH MORE THAN ONE LENS</div>
            <h2 id="news-desk-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">The news desk<span className="text-[#2563eb]">.</span></h2>
          </div>
          {feed && !storiesLoading && !storiesError && <div className="news-feed-meta"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {feed.sourceCount} publishers <span className="mx-1 opacity-40">/</span> {feed.stale ? 'Showing saved coverage' : 'Latest available coverage'}</div>}
        </div>

        <div className="mb-6 mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="news-filters" role="group" aria-label="Filter stories">
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All stories</button>
            <button type="button" aria-pressed={filter === 'multiple'} onClick={() => setFilter('multiple')}>Multiple perspectives {feed && <span>{comparedCount}</span>}</button>
          </div>
          <p className="text-xs text-[#8390a3]">One event. Switch the source. See the difference.</p>
        </div>

        {storiesLoading && <div role="status" aria-label="Loading stories" className="space-y-6">
          <div className="news-skeleton h-[430px] rounded-3xl" />
          <div className="grid gap-6 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="news-skeleton h-80 rounded-3xl" />)}</div>
          <span className="sr-only">Gathering coverage from publishers…</span>
        </div>}
        {storiesError && <div role="alert" className="news-empty"><h3>The news desk will be back shortly.</h3><p>{storiesError}</p><button type="button" onClick={retry} className="story-compare mt-5">Try again</button></div>}
        {!storiesLoading && !storiesError && <>
          {(feed?.stale || feed?.partial) && <p role="status" className="mb-5 text-sm text-[#7c8596]">{feed.stale ? 'Fresh coverage is temporarily unavailable. These are the last stories we gathered.' : 'Some publishers are temporarily unavailable. Showing the coverage we could gather.'}</p>}
          {!stories.length ? <div className="news-empty"><h3>{filter === 'multiple' ? 'More perspectives are on the way.' : 'A quiet moment at the news desk.'}</h3><p>{filter === 'multiple' ? 'No matching events from multiple publishers were found in this feed. Explore all stories for now.' : 'There are no stories available yet. Try again in a moment.'}</p><button type="button" onClick={filter === 'multiple' ? () => setFilter('all') : retry} className="story-compare mt-5">{filter === 'multiple' ? 'View all stories' : 'Try again'}</button></div> : <>
            <StoryCard key={stories[0].id} story={stories[0]} featured onCompare={compare} />
            <div className="mt-6 grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
              {stories.slice(1).map((story) => <StoryCard key={story.id} story={story} onCompare={compare} />)}
            </div>
          </>}
          {!!stories.length && <p className="mt-7 text-center text-xs leading-5 text-[#8a95a6]">Stories are grouped by event. Headlines and excerpts belong to their publishers. Open an analysis to investigate differences.</p>}
        </>}
      </section>
      <div className="mx-auto max-w-7xl border-t border-[#e1e6ef] pt-10"><RecentAnalyses /></div>
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-5 pb-8 pt-4 text-xs text-[#8a95a6] sm:px-8"><span>RealNews. Make room for another perspective.</span><a href="#" className="hover:text-blue-600">Back to top</a></footer>
    </main>
  )
}
