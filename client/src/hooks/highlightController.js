const normalize = (text) => text.replace(/\s+/g, ' ').trim()

// One controller per analysis keeps cached answers tied to their article context.
export function createHighlightController(articles, { request = fetch, delay = 180, timeout = 20000 } = {}) {
  let state = { popup: null, loading: false, result: null, error: '' }
  const listeners = new Set()
  const cache = new Map()
  let generation = 0
  let pendingTimer
  let timeoutTimer
  let activeRequest
  const emit = (next) => {
    state = next
    listeners.forEach((listener) => listener())
  }
  const cancel = () => {
    generation += 1
    clearTimeout(pendingTimer)
    clearTimeout(timeoutTimer)
    activeRequest?.abort()
    activeRequest = null
  }
  const keyFor = (popup) => JSON.stringify([popup.articleId, normalize(popup.text)])
  const start = (popup, force = false) => {
    const key = keyFor(popup)
    if (!force && state.popup && keyFor(state.popup) === key) {
      emit({ ...state, popup })
      return
    }
    cancel()
    if (!force && cache.has(key)) {
      emit({ popup, loading: false, result: cache.get(key), error: '' })
      return
    }
    const current = generation
    emit({ popup, loading: true, result: null, error: '' })
    pendingTimer = setTimeout(async () => {
      const controller = new AbortController()
      activeRequest = controller
      timeoutTimer = setTimeout(() => {
        if (generation !== current) return
        cancel()
        emit({ ...state, loading: false, error: 'Analysis took too long. Please try again.' })
      }, timeout)
      try {
        const response = await request('/api/highlight', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({
            selectedText: popup.text, sourceName: popup.sourceName, selectedArticleId: popup.articleId,
            allArticles: articles.map(({ source, title, contentFull, contentShort, url }) => ({ source, title, contentFull, contentShort, url })),
          }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to analyze selection. Please retry.')
        if (generation !== current) return
        cache.set(key, result)
        if (cache.size > 40) cache.delete(cache.keys().next().value)
        emit({ ...state, loading: false, result, error: '' })
      } catch (error) {
        if (generation === current) emit({ ...state, loading: false, error: error.message || 'Unable to analyze selection. Please retry.' })
      } finally {
        // A previous request must never clear the new request's timer or state.
        if (generation === current) {
          clearTimeout(timeoutTimer)
          activeRequest = null
        }
      }
    }, delay)
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot: () => state,
    open: start,
    retry() { if (state.popup) start(state.popup, true) },
    close() { cancel(); emit({ popup: null, loading: false, result: null, error: '' }) },
  }
}
