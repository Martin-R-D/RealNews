const sources = [
  ['BBC', 'BBC'],
  ['Al Jazeera', 'Al Jazeera'],
  ['Fox News', 'Fox News'],
  ['Guardian', 'The Guardian'],
  ['NYT', 'New York Times'],
]

function Agent({ name, state, message }) {
  const styles = {
    waiting: 'border-dashed border-[#E8EAF0] bg-[#F3F4F6] text-[#6B7280]',
    active: 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] animate-pulse',
    done: 'border-[#16A34A] bg-[#F0FDF4] text-[#16A34A]',
  }

  return (
    <div className={`rounded-2xl border p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] ${styles[state]}`}>
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
  const pipeline = ['Orchestrator', 'Judge']

  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl border border-[#E8EAF0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]">
      <AgentState events={events} name={pipeline[0]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {sources.map(([label, name]) => (
          <AgentState key={name} events={events} label={label} name={name} />
        ))}
      </div>
      <AgentState events={events} name={pipeline[1]} />
    </div>
  )
}

function AgentState({ events, name, label = name }) {
  const state = getState(events, name)
  return <Agent name={label} state={state.status} message={state.message} />
}
