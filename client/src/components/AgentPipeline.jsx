const sources = ['BBC', 'Al Jazeera', 'Fox News', 'Guardian', 'NYT']

function Agent({ name, state, message }) {
  const styles = {
    waiting: 'border-dashed border-slate-700 text-slate-500',
    active: 'border-blue-400 bg-blue-400/10 text-blue-300 animate-pulse',
    done: 'border-green-400/60 bg-green-400/10 text-green-300',
  }

  return (
    <div className={`rounded-xl border p-4 ${styles[state]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{name}</span>
        {state === 'done' && <span aria-label="Done">✓</span>}
      </div>
      <p className="mt-2 text-sm">
        {state === 'waiting' && 'Waiting...'}
        {state === 'active' && (message || 'Active...')}
        {state === 'done' && 'Done'}
      </p>
    </div>
  )
}

function getState(events, name) {
  const event = [...events]
    .reverse()
    .find((item) => item.agent?.toLowerCase() === name.toLowerCase())
  return event
    ? { status: event.status, message: event.message }
    : { status: 'waiting' }
}

export default function AgentPipeline({ events = [] }) {
  const pipeline = ['Orchestrator', 'Analyst', 'Judge']

  return (
    <div className="flex w-full flex-col gap-3">
      <AgentState events={events} name={pipeline[0]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {sources.map((source) => (
          <AgentState key={source} events={events} name={source} />
        ))}
      </div>
      <AgentState events={events} name={pipeline[1]} />
      <AgentState events={events} name={pipeline[2]} />
    </div>
  )
}

function AgentState({ events, name }) {
  const state = getState(events, name)
  return <Agent name={name} state={state.status} message={state.message} />
}
