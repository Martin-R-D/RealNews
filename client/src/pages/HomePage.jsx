import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()

  function handleSubmit(event) {
    event.preventDefault()
    navigate('/results', { state: { topic: topic.trim() } })
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between py-7">
        <span className="text-xl font-bold tracking-tight">RealNews</span>
        <span className="text-sm text-slate-400">
          See every side of the story.
        </span>
      </nav>

      <section className="mx-auto flex max-w-3xl flex-col items-center pt-28 text-center sm:pt-36">
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
          Read the news. All of it.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
          We analyze the same story across multiple sources and expose bias
          automatically.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-12 flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="What story do you want to investigate?"
            aria-label="Topic to analyze"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
          />
          <button
            type="submit"
            className="rounded-xl bg-cyan-400 px-7 py-4 font-semibold text-slate-950 transition hover:bg-cyan-300"
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
              className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-400 hover:text-cyan-300"
            >
              {item}
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
