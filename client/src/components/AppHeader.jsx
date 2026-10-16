import { Link } from 'react-router-dom'

export function ArrowIcon({ direction = 'up-right', className = '' }) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`ui-icon ${className}`}>
    {direction === 'left' ? <path d="M16 10H4m5-5-5 5 5 5" /> : direction === 'right' ? <path d="M4 10h12m-5-5 5 5-5 5" /> : <path d="M5 15 15 5M5 5h10v10" />}
  </svg>
}

export default function AppHeader({ report = false }) {
  return <header className="app-header">
    <div className="app-header-inner">
      <Link to="/" aria-label="RealNews home" className="app-brand">
        <span className="brand-symbol" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><rect x="3" y="6" width="10" height="20" rx="3" fill="currentColor" /><rect x="18" y="6" width="10" height="12" rx="3" fill="currentColor" opacity=".45" /><circle cx="23" cy="24" r="4" fill="#2563eb" /></svg></span>
        RealNews<span className="brand-dot">.</span>
      </Link>
      <nav aria-label="Main navigation" className="app-navigation">
        <a href="/#news-desk" className={!report ? 'is-current' : ''}>News desk</a>
        <a href="/#recent-analyses">Your library</a>
      </nav>
      <div className="app-header-action">{report ? <Link to="/" className="button-primary button-small">New analysis <ArrowIcon /></Link> : <span className="header-caption"><span /> A wider view of the world</span>}</div>
    </div>
  </header>
}
