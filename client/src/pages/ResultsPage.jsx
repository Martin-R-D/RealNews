import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
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
  const topic = state?.topic || ''
  const [events, setEvents] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
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
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-8 text-3xl font-bold">{topic}</h1>
        <pre className="overflow-auto rounded-xl bg-slate-900 p-6 text-sm text-slate-300">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    </main>
  )
}
