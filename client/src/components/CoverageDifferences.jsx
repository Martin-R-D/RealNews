const statuses = {
  mentioned: { label: 'Mentioned', style: 'bg-green-50 text-green-700' },
  not_found: { label: 'Not found', style: 'bg-slate-100 text-slate-600' },
  disputed: { label: 'Disputed', style: 'bg-amber-50 text-amber-800' },
}

function safeUrl(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function publicationDate(value) {
  const date = new Date(value)
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'Publication time unavailable'
}

export default function CoverageDifferences({ coverage, articles = [] }) {
  const findings = coverage?.status === 'complete' ? coverage.findings || [] : []
  const emptyMessage = !coverage
    ? 'This saved analysis predates coverage comparisons. Run a new analysis to compare coverage.'
    : coverage.status === 'unavailable'
      ? 'Coverage comparison is temporarily unavailable. The rest of your analysis is ready.'
      : coverage.status === 'insufficient_sources'
        ? 'At least two sources with article text are needed to compare coverage.'
        : 'No supported coverage differences were identified in the available excerpts. This does not mean the articles cover every detail equally.'

  return (
    <section aria-labelledby="coverage-heading" className="surface coverage-panel">
      <p className="section-kicker">WHAT EACH ACCOUNT BRINGS TO THE STORY</p>
      <h2 id="coverage-heading" className="panel-title mt-2">Coverage differences</h2>
      <p className="mt-3 text-sm leading-6 text-[#6B7280]">
        Details that appear in some accounts but are not found or are disputed in others.
        Comparisons use excerpts and abstracts, not complete articles. “Not found” does not
        mean a publisher omitted a detail. Timing, article length, and focus can explain differences.
      </p>
      {!findings.length && <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{emptyMessage}</p>}
      <div className="mt-5 space-y-4">
        {findings.map((finding, index) => {
          const rows = finding.articles.filter((row) => articles[row.articleId] && statuses[row.status])
          const sources = new Set(rows.map((row) => articles[row.articleId].source))
          const mentioning = new Set(rows.filter((row) => row.status === 'mentioned').map((row) => articles[row.articleId].source))
          return (
            <details key={index} className="coverage-finding">
              <summary className="coverage-summary">
                <span className="font-semibold">{finding.detail}</span>
                <span className="mt-1 block text-sm text-[#6B7280]">
                  Mentioned in {mentioning.size} of {sources.size} compared sources · View passages
                </span>
              </summary>
              <ul className="mt-4 space-y-4">
                {rows.map((row) => {
                  const article = articles[row.articleId]
                  const status = statuses[row.status]
                  const url = safeUrl(article.url)
                  return (
                    <li key={row.articleId} className="border-t border-[#E8EAF0] pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{article.source}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.style}`}>{status.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#6B7280]">{publicationDate(article.publishedAt)} · Excerpt only</p>
                      {row.quote ? (
                        <blockquote className="mt-3 border-l-2 border-blue-200 pl-3 text-sm leading-6">“{row.quote}”</blockquote>
                      ) : <p className="mt-3 text-sm text-[#6B7280]">This detail was not found in the available excerpt.</p>}
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-blue-700 underline underline-offset-2">{article.title || 'Read original article'} ↗</a>
                      ) : <p className="mt-2 text-sm text-[#6B7280]">{article.title} · Original link unavailable</p>}
                    </li>
                  )
                })}
              </ul>
            </details>
          )
        })}
      </div>
    </section>
  )
}
