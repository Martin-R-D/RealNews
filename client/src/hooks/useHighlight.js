import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { createHighlightController } from './highlightController'

export default function useHighlight(articles) {
  const controller = useMemo(() => createHighlightController(articles), [articles])
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

  useEffect(() => {
    const articleText = (node) => (node?.nodeType === 1 ? node : node?.parentElement)?.closest('[data-highlight-source]')
    let startedInArticle = false
    const select = (event) => {
      if (event.target.closest?.('[data-highlight-popup]')) return
      if (event.type === 'pointerup') {
        const validGesture = startedInArticle || articleText(event.target)
        startedInArticle = false
        if (!validGesture) return
      }
      if (event.type === 'keyup' && !['Shift', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
      const selection = window.getSelection()
      const text = selection?.toString().trim()
      if (!text || text.length < 20 || !selection.rangeCount) {
        if (event.type === 'pointerup' && articleText(event.target)) controller.close()
        return
      }
      const element = articleText(selection.anchorNode) || articleText(selection.focusNode)
      if (!element) return
      const range = selection.getRangeAt(0).cloneRange()
      if (!range.intersectsNode(element)) return
      const articleRange = document.createRange()
      articleRange.selectNodeContents(element)
      // Native paragraph selections may end at the following heading. Clip that
      // whitespace boundary, but reject selections containing text outside this article.
      if (range.compareBoundaryPoints(Range.START_TO_START, articleRange) < 0) {
        range.setStart(articleRange.startContainer, articleRange.startOffset)
      }
      if (range.compareBoundaryPoints(Range.END_TO_END, articleRange) > 0) {
        range.setEnd(articleRange.endContainer, articleRange.endOffset)
      }
      const normalize = (value) => value.replace(/\s+/g, ' ').trim()
      if (normalize(range.toString()) !== normalize(text)) return
      controller.open({ text, sourceName: element.dataset.highlightSource, articleId: Number(element.dataset.articleId), range })
    }
    const outside = (event) => {
      startedInArticle = Boolean(articleText(event.target))
      if (!event.target.closest?.('[data-highlight-popup]') && !articleText(event.target)) controller.close()
    }
    const escape = (event) => { if (event.key === 'Escape') controller.close() }
    document.addEventListener('pointerup', select)
    document.addEventListener('keyup', select)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerup', select)
      document.removeEventListener('keyup', select)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      controller.close()
    }
  }, [controller])
  return { ...state, onClose: controller.close, onRetry: controller.retry }
}
