import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ExercisePose } from '../components/ExercisePose'
import { db, defaultProfile } from '../db/database'
import { workoutSchema, type Workout } from '../domain/activity'
import { addDays, dateLabel, localDate } from '../domain/dates'
import { planForDay, trainingLoad } from '../domain/program'
import { workoutExercises } from '../domain/workoutPlan'

export function Workouts({ equipment = false }: { equipment?: boolean }) {
  const history = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), [], [])
  const program = useLiveQuery(() => db.programs.get('program'))
  const profile = useLiveQuery(() => db.profiles.get('profile')) ?? defaultProfile
  const today = localDate()
  const number = program && Array.from({ length: profile.programDays }, (_, index) => index + 1)
    .find((day) => addDays(program.started, day - 1) === today)
  const scheduled = number ? planForDay(number, profile).kind : undefined
  const load = trainingLoad(profile, number ?? 1)
  const { sets, restSeconds } = load
  const [preparing, setPreparing] = useState<Workout['kind']>()
  const preview = preparing ? workoutExercises(preparing, equipment, today, load) : undefined
  const [deadline, setDeadline] = useState<number>()
  const [seconds, setSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const active = history.find((row) => !row.finished)
  const finished = history.filter((row) => row.finished && Boolean(row.equipment) === equipment)
  const exerciseIndex = active?.exercises.findIndex((row) => row.reps.includes(null)) ?? -1
  const exercise = exerciseIndex < 0 ? undefined : active?.exercises[exerciseIndex]
  const setIndex = exercise?.reps.indexOf(null) ?? -1

  useEffect(() => {
    if (!deadline) return
    const tick = () => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [deadline])

  function timer(time: number) { setSeconds(time); setDeadline(Date.now() + time * 1000) }
  function clearTimer() { setSeconds(0); setDeadline(undefined) }

  async function save(record: Workout) {
    setBusy(true)
    try { await db.workouts.put(workoutSchema.parse(record)); setMessage('Сохранено.'); return true }
    catch { setMessage('Не удалось сохранить тренировку.'); return false }
    finally { setBusy(false) }
  }

  async function start() {
    if (!preparing || !preview) return
    const kind = preparing
    const record: Workout = { id: crypto.randomUUID(), date: today, kind, finished: false, restSeconds,
      equipment: equipment ? true : undefined,
      exercises: preview,
    }
    if (await save(record)) { setPreparing(undefined); clearTimer() }
  }

  async function saveSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!active || !exercise || setIndex < 0) return
    const result = Number(new FormData(event.currentTarget).get('reps'))
    const next = { ...active, exercises: active.exercises.map((item, index) => index === exerciseIndex ? {
      ...item, reps: item.reps.map((reps, i) => i === setIndex ? result : reps),
    } : item) }
    if (await save(next)) timer(active.restSeconds)
  }

  async function finish() {
    if (active && await save({ ...active, finished: true })) { clearTimer(); setMessage('Тренировка завершена.') }
  }

  return <>
    <header className="page-heading"><h1>{equipment ? 'Тренировки с гантелями' : 'Тренировки без инвентаря'}</h1><div className="inline-actions">
      <Link to={equipment ? '/workouts' : '/workouts/equipment'} className="secondary">{equipment ? 'Без инвентаря' : 'С гантелями'}</Link>
      <Link to="/treadmill" className="secondary">Беговая дорожка</Link>
    </div></header>
    {active && Boolean(active.equipment) !== equipment && <p className="panel">
      Открыта незавершённая тренировка. <Link to={active.equipment ? '/workouts/equipment' : '/workouts'}>Перейти к тренировке</Link>
    </p>}
    {!active && !preparing && <section className="panel form-grid"><h2>Выберите программу</h2>
      {!equipment && scheduled && <p>По плану сегодня · тренировка {scheduled}</p>}
      <button className="action" onClick={() => setPreparing('А')}>Начать программу А</button>
      <button className="secondary" onClick={() => setPreparing('Б')}>Начать программу Б</button>
      <p className="muted">По плану · {sets} {sets === 1 ? 'подход' : 'подхода'} на упражнение. Используйте комфортную нагрузку.</p>
    </section>}
    {!active && preparing && preview && <section className="panel form-grid"><h2>Программа {preparing} · разминка</h2>
      <ol className="list-decimal ps-6"><li>Начните с лёгкой ходьбы на месте.</li><li>Добавьте плавные движения плечами, руками и ногами.</li><li>Постепенно разогрейтесь в комфортном темпе.</li></ol>
      <h3>Упражнения на сегодня</h3>
      <ol className="list-decimal ps-6">{preview.map(({ name, target }) => <li key={name}>{name} · {target} повторений</li>)}</ol>
      {deadline && <p role="timer">{seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Время вышло'}</p>}
      {!deadline && <button className="secondary" onClick={() => timer(300)}>Запустить таймер · 5 мин</button>}
      <button className="action" disabled={busy} onClick={() => void start()}>Разминка выполнена</button>
      <button className="secondary" onClick={() => { clearTimer(); setPreparing(undefined) }}>Назад</button>
    </section>}
    {active && Boolean(active.equipment) === equipment && exercise && seconds > 0 && <section className="panel form-grid"><h2>Отдых между подходами</h2><p role="timer">{seconds} сек</p><p>Дождитесь, пока дыхание станет спокойнее.</p><button className="secondary" onClick={clearTimer}>Я готов продолжать</button></section>}
    {active && Boolean(active.equipment) === equipment && exercise && seconds === 0 && <form key={exerciseIndex + '-' + setIndex} className="panel form-grid" onSubmit={saveSet}>
      <h2>{exercise.name}</h2>
      <p className="muted">Программа {active.kind} · упражнение {exerciseIndex + 1} из {active.exercises.length} · подход {setIndex + 1} из {exercise.reps.length}</p>
      <ExercisePose name={exercise.name} />
      <p>{exercise.technique}</p>
      <p>Ориентир · {exercise.target} повторений.</p>
      <label>Сколько получилось<input name="reps" type="number" min="0" max="200" required /></label>
      <button className="action" disabled={busy}>Записать подход</button>
      <button className="secondary" type="button" disabled={busy} onClick={() => { if (window.confirm('Завершить и оставить записанные подходы?')) void finish() }}>Закончить раньше</button>
    </form>}
    {active && Boolean(active.equipment) === equipment && !exercise && <section className="panel form-grid"><h2>Все подходы записаны</h2><button className="action" disabled={busy} onClick={() => void finish()}>Завершить тренировку</button></section>}
    <p className="section-gap muted">При боли в груди, головокружении или необычной одышке остановитесь.</p>
    <p role="status">{message}</p>
    <section className="panel section-gap"><h2>История</h2>
      {finished.length ? <ul className="record-list">{finished.map((row) => <li key={row.id}>
        <details><summary>{dateLabel(row.date)} · программа {row.kind}{row.minutes ? ` · ${row.minutes} мин` : ''}</summary>
          <ul>{row.exercises.map((item, index) => <li key={index}>{item.name} · {item.reps.map((reps) => reps ?? '—').join(' / ')}</li>)}</ul>
          <form className="form-grid section-gap" onSubmit={(event) => {
            event.preventDefault()
            const minutes = new FormData(event.currentTarget).get('minutes')
            void save({ ...row, minutes: minutes ? Number(minutes) : undefined })
          }}>
            <label>Продолжительность силовой, мин<input name="minutes" type="number" min="1" max="180" step="1" defaultValue={row.minutes} /></label>
            <button className="secondary" disabled={busy}>Сохранить длительность</button>
          </form>
        </details>
      </li>)}</ul> : <p className="muted">Завершённых тренировок пока нет.</p>}
    </section>
  </>
}
