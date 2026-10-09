function scoreClass(score) {
  if (score < 40) return 'bg-[#FEF2F2] text-[#DC2626]'
  if (score > 60) return 'bg-[#FFF7ED] text-[#EA580C]'
  return 'bg-[#F0FDF4] text-[#16A34A]'
}

export default function HighlightPopup({ popup, loading, result, onClose }) {
  return (
    <div
      className="absolute z-[1000] min-w-[320px] max-w-[480px] animate-[highlight-in_150ms_ease-out_forwards] rounded-xl border border-[#E8EAF0] bg-white p-4 shadow-lg"
      style={{ left: popup.x, top: popup.y, transform: 'translate(-50%, -100%)' }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-2 text-lg text-[#6B7280] hover:text-[#0F1117]"
        aria-label="Close comparison"
      >
        ×
      </button>
      <p className="pr-5 text-xs text-[#6B7280]">Selected from {popup.sourceName}</p>
      <p className="mt-2 line-clamp-2 italic text-[#0F1117]">{popup.text}</p>
      <div className="my-3 border-t border-[#E8EAF0]" />
      {loading && (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8EAF0] border-t-[#2563EB]" />
          Analyzing...
        </div>
      )}
      {result && (
        <div className="space-y-3 text-sm">
          <span className={`inline-block rounded-full px-3 py-1 font-medium ${scoreClass(result.biasScore)}`}>
            Bias score: {result.biasScore}/100
          </span>
          <div>
            <p className="text-xs font-medium text-[#6B7280]">Most neutral version:</p>
            <p className="mt-1 text-[#16A34A]">{result.neutralVersion}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#6B7280]">How others said it:</p>
            <div className="mt-2 space-y-2">
              {(result.howOthersSaidIt || []).map((item) => (
                <div key={item.source} className="flex gap-2">
                  <span className="shrink-0 rounded bg-[#F1F5F9] px-2 py-1 text-xs text-[#0F1117]">
                    {item.source}
                  </span>
                  <span className="text-[#6B7280]">{item.quote}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
