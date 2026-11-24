import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db } from './db/database'
import { AccountControls } from './pages/Account'
import { Settings } from './pages/Settings'
import { Weight } from './pages/Weight'
import { Nutrition } from './pages/Nutrition'
import { Workouts } from './pages/Workouts'
import { Treadmill } from './pages/Treadmill'
import { Calendar } from './pages/Calendar'
import { Shopping } from './pages/Shopping'
import { lazy, Suspense } from 'react'
import { Backup } from './pages/Backup'
import { ReminderBanner, Reminders } from './pages/Reminders'

const Progress = lazy(() => import('./pages/Progress').then((module) => ({ default: module.Progress })))
import { Activity, ChartNoAxesCombined, Dumbbell, Ellipsis, House, Utensils } from 'lucide-react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { More } from './pages/More'

export function App({ accountName }: { accountName: string }) {
  const profile = useLiveQuery(() => db.profiles.get('profile'))
  useEffect(() => { document.documentElement.dataset.theme = profile?.theme ?? 'light' }, [profile?.theme])
  return (
    <div className="shell">
      <header className="app-header">
        <Link className="brand" to="/"><span><Activity size={22} aria-hidden="true" /></span> Моё похудение</Link>
      </header>
      <main className="content">
        <ReminderBanner />
        <Suspense fallback={<p role="status">Загрузка…</p>}><Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/more" element={<><More /><section className="panel section-gap"><h2>Личный кабинет</h2><AccountControls name={accountName} /></section></>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/weight" element={<Weight />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/treadmill" element={<Treadmill />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/shopping" element={<Shopping />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/backup" element={<Backup />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="*" element={<section className="panel"><h1>Страница не найдена</h1><Link to="/">На главную</Link></section>} />
        </Routes></Suspense>
      </main>
      <nav className="bottom-nav" aria-label="Основная навигация">
        <NavLink end to="/"><House size={22} aria-hidden="true" />Главная</NavLink>
        <NavLink to="/nutrition"><Utensils size={22} aria-hidden="true" />Питание</NavLink>
        <NavLink to="/workouts"><Dumbbell size={22} aria-hidden="true" />Тренировки</NavLink>
        <NavLink to="/progress"><ChartNoAxesCombined size={22} aria-hidden="true" />Прогресс</NavLink>
        <NavLink to="/more"><Ellipsis size={22} aria-hidden="true" />Ещё</NavLink>
      </nav>
    </div>
  )
}
