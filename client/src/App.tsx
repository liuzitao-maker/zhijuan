import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { getHealth, type Health } from './lib/api'
import Home from './pages/Home'
import Generate from './pages/Generate'
import Library from './pages/Library'
import PaperDetail from './pages/PaperDetail'
import Report from './pages/Report'

const NAV = [
  { to: '/', label: '工作台', end: true },
  { to: '/generate', label: '新建试卷' },
  { to: '/library', label: '试卷库' },
]

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">卷</div>
          <div className="brand-text">
            <strong>智卷</strong>
            <span>AI Exam Engine</span>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-dot" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div>
            模型 <b>{health?.model ?? '连接中…'}</b>
          </div>
          <div>
            状态{' '}
            <b style={{ color: health?.hasApiKey ? '#0f9d6e' : '#d83a3a' }}>
              {health ? (health.hasApiKey ? 'Key 已配置' : 'Key 未配置') : '—'}
            </b>
          </div>
          <div style={{ marginTop: 6 }}>出题 → 独立审题 → 自动修复</div>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/generate" element={<Generate />} />
            <Route path="/library" element={<Library />} />
            <Route path="/papers/:id" element={<PaperDetail />} />
            <Route path="/reports/:id" element={<Report />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
