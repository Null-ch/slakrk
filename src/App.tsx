import { Activity, Ellipsis, House } from 'lucide-react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { More } from './pages/More'

export function App() {
  return (
    <div className="shell">
      <header className="app-header">
        <Link className="brand" to="/"><span><Activity size={22} aria-hidden="true" /></span> Моё похудение</Link>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/more" element={<More />} />
          <Route path="*" element={<section className="panel"><h1>Страница не найдена</h1><Link to="/">На главную</Link></section>} />
        </Routes>
      </main>
      <nav className="bottom-nav" aria-label="Основная навигация">
        <NavLink end to="/"><House size={22} aria-hidden="true" />Главная</NavLink>
        <NavLink to="/more"><Ellipsis size={22} aria-hidden="true" />Ещё</NavLink>
      </nav>
    </div>
  )
}
