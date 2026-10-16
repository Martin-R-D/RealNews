const getState = (events, name) => [...events].reverse().find((item) => item.agent?.toLowerCase() === name.toLowerCase()) || { status: 'waiting' }

function Agent({ events, name, label = name, number }) {
  const { status, message, articlesFound } = getState(events, name)
  return <div className={`agent-card agent-${status}`}>
    <span className="agent-indicator" aria-hidden="true">{status === 'done' ? <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m5 10 3 3 7-7" /></svg> : status === 'error' ? '!' : number || <span />}</span>
    <div><h3>{label}</h3><p>{status === 'done' ? (articlesFound != null ? `${articlesFound} articles found` : 'Complete') : status === 'error' ? 'Source unavailable' : status === 'active' ? message || 'Gathering coverage…' : 'Waiting to begin'}</p></div>
    {status === 'active' && <span className="agent-spinner" aria-label="In progress" />}
  </div>
}

export default function AgentPipeline({ events = [], selectedSources = [] }) {
  const selected = events.find((event) => Array.isArray(event.selectedSources))?.selectedSources || selectedSources
  const names = [...new Set(selected.map((item) => typeof item === 'string' ? item : item.source || item.name).filter(Boolean))]
  return <section className="surface pipeline" aria-label="Analysis progress">
    <div className="section-title-row"><div><p className="section-kicker">BEHIND THE BRIEFING</p><h2 className="panel-title">A few perspectives. One clear picture.</h2></div><span className="status-pill"><span /> In progress</span></div>
    <Agent events={events} name="Orchestrator" label="Finding the right perspectives" number="01" />
    <div className="pipeline-sources">{names.length ? names.map((name) => <Agent key={name} events={events} name={name} />) : [0, 1, 2, 3].map((index) => <div key={index} className="agent-placeholder"><span /> Selecting a source</div>)}</div>
    <Agent events={events} name="Judge" label="Comparing the coverage" number="03" />
  </section>
}
