import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/database'
import { ExercisePose } from '../components/ExercisePose'
import { exercisePrograms, workoutSchema, type Workout } from '../domain/activity'
import { dateLabel, localDate } from '../domain/dates'

export function Workouts() {
  const history = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), [], [])
  const [activeId, setActiveId] = useState<string>()
  const [step, setStep] = useState(0)
  const [message, setMessage] = useState('')
  const active = history.find((row) => row.id === activeId && !row.finished) ?? history.find((row) => !row.finished)
  const exercise = active?.exercises[step]
  const [timer, setTimer] = useState<number>()
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!timer) return
    const tick = () => setSeconds(Math.max(0, Math.ceil((timer - Date.now()) / 1000)))
    tick()
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [timer])

  function startTimer(duration: number) { setSeconds(duration); setTimer(Date.now() + duration * 1000) }

  async function save(value: Workout, success: string) {
    try { await db.workouts.put(workoutSchema.parse(value)); setMessage(success); return true }
    catch { setMessage('Проверьте введённые данные.'); return false }
  }

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const kind = fields.get('kind') === 'Б' ? 'Б' : 'А'
    const record: Workout = { id: crypto.randomUUID(), date: localDate(), kind, finished: false,
      restSeconds: Number(fields.get('rest')),
      exercises: exercisePrograms[kind].map((row) => ({ ...row, reps: Array<null>(Number(fields.get('sets'))).fill(null) })),
    }
    if (await save(record, 'Тренировка начата.')) { setActiveId(record.id); setStep(0); setTimer(undefined) }
  }

  async function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!active || !exercise) return
    const fields = new FormData(event.currentTarget)
    const next = { name: String(fields.get('name')), technique: String(fields.get('technique')), target: String(fields.get('target')),
      reps: fields.getAll('reps').map((value) => value === '' ? null : Number(value)),
    }
    await save({ ...active, exercises: active.exercises.map((row, index) => index === step ? next : row) }, 'Подходы сохранены.')
  }

  return <>
    <header className="page-heading"><h1>Тренировки</h1><Link to="/treadmill" className="secondary">Беговая дорожка</Link></header>
    <section className="panel">
      <h2>Перед началом</h2><p>Разминка 5 минут. Не тренируйся до отказа. При боли в груди, головокружении или необычной одышке остановись.</p>
      <div className="inline-actions section-gap"><button className="secondary" onClick={() => startTimer(300)}>Таймер разминки</button>
      {active && <button className="secondary" onClick={() => startTimer(active.restSeconds)}>Таймер отдыха</button>}</div>
      {timer && <p role="timer">{seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Таймер завершён'}</p>}
    </section>
    {!active && <form className="panel form-grid section-gap" onSubmit={start}>
      <h2>Начать силовую</h2>
      <label>Программа<select name="kind"><option>А</option><option>Б</option></select></label>
      <label>Подходов<select name="sets"><option>2</option><option>3</option></select></label>
      <label>Отдых, секунд<input name="rest" type="number" min="1" defaultValue="75" required /></label>
      <p className="muted">В первую неделю по программе 2 подхода. Увеличивай объём только при хорошем восстановлении. Штанга 60 кг не входит в программу.</p>
      <button className="action">Начать тренировку</button>
    </form>}
    {active && exercise && <form key={active.id + '-' + step} className="panel form-grid section-gap" onSubmit={saveExercise}>
      <h2>Программа {active.kind} · упражнение {step + 1} из {active.exercises.length}</h2>
      <h3 className="font-semibold">{exercise.name}</h3>
      <ExercisePose name={exercise.name} />
      <p className="muted">План повторений · {exercise.target}</p>
      <p>{exercise.technique}</p>
      <details><summary>Заменить упражнение или изменить цель</summary>
        <label>Название<input name="name" defaultValue={exercise.name} required /></label>
        <label>Техника<textarea name="technique" defaultValue={exercise.technique} required /></label>
        <label>Цель по повторениям<input name="target" defaultValue={exercise.target} required /></label>
      </details>
      {exercise.reps.map((reps, index) => <label key={index}>Подход {index + 1} · повторения<input name="reps" type="number" min="0" defaultValue={reps ?? ''} /></label>)}
      <button className="action">Выполнено · сохранить подходы</button>
      <div className="inline-actions">
        {step > 0 && <button className="secondary" type="button" onClick={() => setStep(step - 1)}>Назад</button>}
        {step + 1 < active.exercises.length && <button className="secondary" type="button" onClick={() => setStep(step + 1)}>Следующее упражнение</button>}
        <button className="secondary" type="button" onClick={() => {
          if (!active.exercises.some((row) => row.reps.some((reps) => reps !== null))) { setMessage('Сохрани хотя бы один подход.'); return }
          if (window.confirm('Завершить тренировку и сохранить отмеченные подходы?')) void save({ ...active, finished: true }, 'Тренировка завершена.')
        }}>Завершить тренировку</button>
      </div>
    </form>}
    <p role="status" className="section-gap">{message}</p>
    <section className="panel section-gap"><h2>История</h2>
      {history.filter((row) => row.finished).length === 0 ? <p className="muted">Завершённых тренировок пока нет.</p> :
        <ul className="record-list">{history.filter((row) => row.finished).map((row) => <li key={row.id}>
          <details><summary>{dateLabel(row.date)} · программа {row.kind}</summary><ul>{row.exercises.map((item, index) => <li key={index}>{item.name} · {item.reps.map((reps) => reps ?? '—').join(' / ')}</li>)}</ul></details>
        </li>)}</ul>}
    </section>
  </>
}
