import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RecentAnalyses from '../components/RecentAnalyses.jsx'

const topics = [
  'Israel-Palestine War',
  'US Elections',
  'Climate Change',
  'AI Regulation',
  'Ukraine War',
  'Immigration Crisis',
]

export default function HomePage() {
  const [topic, setTopic] = useState('')
  const [stories, setStories] = useState([])
  const [storiesLoading, setStoriesLoading] = useState(true)
  const [storiesError, setStoriesError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/top-stories')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load top stories')
        return response.json()
      })
      .then(setStories)
      .catch((error) => setStoriesError(error.message))
      .finally(() => setStoriesLoading(false))
  }, [])

  function handleSubmit(event) {
    event.preventDefault()
    navigate('/results', { state: { topic: topic.trim() } })
  }

  return (
    <main className="min-h-screen bg-[#F8F9FB] text-[#0F1117]">
      <nav className="sticky top-0 z-10 border-b border-[#E8EAF0] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
            RealNews
          </span>
          <span className="text-sm text-[#6B7280]">
          See every side of the story.
          </span>
        </div>
      </nav>

      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-16 pt-24 text-center sm:pt-32">
        <h1 className="font-['Playfair_Display'] text-5xl font-semibold leading-tight tracking-tight text-[#0F1117] sm:text-7xl">
          See every side of the story
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#6B7280]">
          We analyze the same story across multiple sources and expose bias
          automatically.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-12 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E8EAF0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] focus-within:border-2 focus-within:border-[#2563EB] focus-within:shadow-lg sm:flex-row"
        >
          <input
            type="text"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="What story do you want to investigate?"
            aria-label="Topic to analyze"
            className="min-w-0 flex-1 border-0 bg-white px-5 py-4 text-base text-[#0F1117] outline-none placeholder:text-[#6B7280]"
          />
          <button
            type="submit"
            className="bg-[#2563EB] px-7 py-4 font-semibold text-white transition hover:bg-blue-700"
          >
            Analyze
          </button>
        </form>

        <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
          {topics.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTopic(item)}
              className="rounded-2xl border border-transparent bg-[#F3F4F6] px-4 py-2 text-sm text-[#6B7280] transition hover:bg-[#2563EB] hover:text-white"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <RecentAnalyses />

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="text-2xl font-bold">What the world is talking about</h2>
        {storiesLoading && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.slice(0, 6).map((topic) => (
              <div key={topic} className="h-40 animate-pulse rounded-2xl border border-[#E8EAF0] bg-white" />
            ))}
          </div>
        )}
        {storiesError && <p className="mt-6 text-[#DC2626]">{storiesError}</p>}
        {!storiesLoading && !storiesError && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <article key={story.url} className="overflow-hidden rounded-2xl border border-[#E8EAF0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]">
                {story.thumbnail ? (
                  <img src={story.thumbnail} alt="" className="h-[180px] w-full object-cover" />
                ) : (
                  <div className="flex h-[180px] items-center justify-center bg-[#F3F4F6] text-3xl" aria-label="No image">
                    📰
                  </div>
                )}
                <div className="p-6">
                  <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-medium text-[#2563EB]">
                    {story.section}
                  </span>
                  <h3 className="mt-4 font-semibold leading-6 text-[#0F1117]">{story.title}</h3>
                  <a href={story.url} target="_blank" rel="noreferrer" className="mt-5 inline-block text-sm text-[#2563EB] hover:text-blue-700">
                    Read more →
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
