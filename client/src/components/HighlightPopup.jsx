import { useLayoutEffect, useRef, useState } from 'react'

function scoreClass(score) {
  if (score < 40) return 'bg-[#F0FDF4] text-[#16A34A]'
  if (score > 60) return 'bg-[#FEF2F2] text-[#DC2626]'
  return 'bg-[#FFF7ED] text-[#EA580C]'
}

export default function HighlightPopup({ popup, loading, result, error, onClose, onRetry }) {
  const popupRef = useRef(null)
  const [position, setPosition] = useState({ left: 12, top: 12, visibility: 'hidden' })
  useLayoutEffect(() => {
    const place = () => {
      const anchor = popup.range.getBoundingClientRect()
      const element = popupRef.current
      if (!element) return
      const width = element.offsetWidth
      const height = element.offsetHeight
      const preferredTop = anchor.top - height - 10
      setPosition({
        left: Math.max(12, Math.min(window.innerWidth - width - 12, anchor.left + anchor.width / 2 - width / 2)),
        top: Math.max(12, Math.min(window.innerHeight - height - 12, preferredTop >= 12 ? preferredTop : anchor.bottom + 10)),
        visibility: 'visible',
      })
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(popupRef.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [popup.range])
  return (
    <div
      ref={popupRef}
      data-highlight-popup
      role="dialog"
      aria-label="Selection analysis"
      aria-busy={loading}
      className="fixed z-[1000] w-[calc(100vw-24px)] max-w-[480px] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-xl border border-[#E8EAF0] bg-white p-4 shadow-lg"
      style={position}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
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
      {error && (
        <div role="alert" className="space-y-2 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={onRetry} className="rounded-lg bg-blue-600 px-3 py-2 font-medium text-white">Retry</button>
        </div>
      )}
      {loading && (
        <div role="status" className="flex items-center gap-2 text-sm text-[#6B7280]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8EAF0] border-t-[#2563EB]" />
          Analyzing...
        </div>
      )}
      {result && (
        <div className="space-y-3 text-sm">
          <span title="Higher scores indicate more loaded wording or framing" className={`inline-block rounded-full px-3 py-1 font-medium ${scoreClass(result.biasScore)}`}>
            Bias score: {result.biasScore}/100
          </span>
          <div>
            <p className="text-xs font-medium text-[#6B7280]">Most neutral version:</p>
            <p className="mt-1 text-[#16A34A]">{result.neutralVersion}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#6B7280]">How others said it:</p>
            <p className="mt-1 text-xs text-[#6B7280]">Quotes checked against available excerpts. Read the originals for context.</p>
            {!result.howOthersSaidIt?.length && <p className="mt-2 text-[#6B7280]">No supported comparison was found in the available excerpts.</p>}
            <div className="mt-2 space-y-2">
              {(result.howOthersSaidIt || []).map((item) => (
                <div key={`${item.source}-${item.articleId}`} className="space-y-1">
                  <span className="shrink-0 rounded bg-[#F1F5F9] px-2 py-1 text-xs text-[#0F1117]">
                    {item.source}
                  </span>
                  <blockquote className="text-[#6B7280]">“{item.quote}”</blockquote>
                  {/^https?:\/\//i.test(item.url || '') && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-blue-700 underline">Read original article ↗</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
