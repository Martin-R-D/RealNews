import { useId, useState } from 'react'

const sourceColors = ['#2563eb', '#0d9488', '#7c3aed', '#e05b34', '#475569', '#be185d']
const safeUrl = (value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null }
}

function ArrowUpRight() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" className="ml-1 inline-block h-3 w-3 align-middle"><path d="m4 12 8-8M4 4h8v8" /></svg>
}

function relativeTime(value) {
  const date = Date.parse(value)
  if (!Number.isFinite(date)) return 'Publication time unavailable'
  const minutes = Math.max(0, Math.floor((Date.now() - date) / 60000))
  if (minutes < 1) return 'Just published'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}

function StoryVisual({ image, featured }) {
  const [failedImage, setFailedImage] = useState(null)
  const gradientId = useId()
  return (
    <div className={`story-visual ${featured ? 'story-visual-featured' : ''}`}>
      {safeUrl(image) && failedImage !== image ? (
        <img src={image} alt="" loading={featured ? 'eager' : 'lazy'} onError={() => setFailedImage(image)} className="h-full w-full object-cover" />
      ) : (
        <svg viewBox="0 0 600 400" aria-hidden="true" className="h-full w-full object-cover">
          <defs><radialGradient id={gradientId}><stop stopColor="#245c75" /><stop offset="1" stopColor="#10213c" /></radialGradient></defs>
          <rect width="600" height="400" fill={`url(#${gradientId})`} />
          <g fill="none" stroke="#79d8dc" opacity="0.4" strokeWidth="1">
            <circle cx="300" cy="200" r="145" /><ellipse cx="300" cy="200" rx="85" ry="145" /><ellipse cx="300" cy="200" rx="28" ry="145" />
            <ellipse cx="300" cy="200" rx="145" ry="50" /><ellipse cx="300" cy="200" rx="135" ry="100" />
            <path d="M155 200h290M300 55v290M100 310Q300 20 510 170M120 100Q290 380 510 260" />
          </g>
          <g fill="#a4f4d5"><circle cx="220" cy="135" r="5" /><circle cx="377" cy="157" r="5" /><circle cx="337" cy="270" r="5" /><circle cx="185" cy="225" r="4" /></g>
          <path d="M220 135Q270 100 377 157M220 135Q200 220 337 270M185 225Q300 150 377 157" fill="none" stroke="#a4f4d5" strokeWidth="2" opacity="0.6" />
        </svg>
      )}
      <div className="story-image-shade" />
      <span className="story-image-label"><span className="h-1.5 w-1.5 rounded-full bg-[#a4f4d5]" /> {featured ? 'THE BIG PICTURE' : 'FROM THE NEWS DESK'}</span>
    </div>
  )
}

export default function StoryCard({ story, featured = false, onCompare }) {
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, story.articles.findIndex((article) => article.title === story.title)))
  const article = story.articles[selectedIndex] || story.articles[0]
  const id = useId()
  const sourceCount = new Set(story.articles.map((item) => item.source)).size
  if (!article) return null

  function changeTab(event, index) {
    let next
    if (event.key === 'ArrowRight') next = (index + 1) % story.articles.length
    if (event.key === 'ArrowLeft') next = (index - 1 + story.articles.length) % story.articles.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = story.articles.length - 1
    if (next === undefined) return
    event.preventDefault()
    setSelectedIndex(next)
    event.currentTarget.parentElement.children[next].focus()
  }

  return (
    <article data-story-id={story.id} className={`story-card ${featured ? 'story-card-featured' : ''}`}>
      <StoryVisual image={article.thumbnail || story.thumbnail} featured={featured} />
      <div className="story-body">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
          <span className="story-category">{story.category || 'World'}</span>
          {story.isDeveloping && <span className="story-developing"><span className="h-1.5 w-1.5 rounded-full bg-current" /> New coverage</span>}
          <span className="story-time ml-auto normal-case tracking-normal">{relativeTime(article.publishedAt)}</span>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <div className="flex -space-x-1.5" aria-hidden="true">
            {story.articles.slice(0, 4).map((item, index) => <span key={item.source} className="source-orbit" style={{ background: sourceColors[index % sourceColors.length] }}>{item.source.split(' ').filter((word) => word !== 'The').map((word) => word[0]).join('').slice(0, 2)}</span>)}
          </div>
          <span className="story-source-count">{sourceCount > 1 ? `${sourceCount} sources. A wider view.` : 'One source so far'}</span>
        </div>

        <div role="tablist" aria-label="Choose a source perspective" className="story-tabs">
          {story.articles.map((item, index) => (
            <button key={item.source} id={`${id}-tab-${index}`} type="button" role="tab" aria-selected={selectedIndex === index} aria-controls={`${id}-panel`} tabIndex={selectedIndex === index ? 0 : -1}
              onClick={() => setSelectedIndex(index)} onKeyDown={(event) => changeTab(event, index)} className="story-tab">
              {item.source}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${selectedIndex}`} tabIndex={0} className="story-panel">
          <div key={article.url} className="story-swap">
            <h3 className="story-headline">{article.title}</h3>
            <p className="story-excerpt">{article.abstract || 'Open the original article to read this publisher’s account.'}</p>
          </div>
          <div className="story-actions">
            <button type="button" onClick={() => onCompare(story.title)} className="story-compare">Compare coverage <ArrowUpRight /></button>
            {safeUrl(article.url) && <a href={article.url} target="_blank" rel="noopener noreferrer" className="story-original">Read original <ArrowUpRight /></a>}
          </div>
        </div>

        <details className="story-briefing">
          <summary>Quick briefing & originals <span aria-hidden="true">+</span></summary>
          <div className="space-y-4 pt-4">
            <p className="text-xs leading-5 opacity-70">Publisher excerpts on this event. Sources may emphasize different details; these are not a fact-check.</p>
            {story.articles.map((item) => <div key={item.url}>
              <p className="text-xs font-semibold">{item.source} <span className="ml-1 font-normal opacity-60">· {relativeTime(item.publishedAt)}</span></p>
              <p className="mt-1 text-sm leading-6 opacity-80">{item.abstract || item.title}</p>
              {safeUrl(item.url) && <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs underline underline-offset-4">Read {item.source} <ArrowUpRight /></a>}
            </div>)}
          </div>
        </details>
      </div>
    </article>
  )
}
