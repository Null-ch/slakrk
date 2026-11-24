import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ExercisePose } from '../components/ExercisePose'
import { db } from '../db/database'
import { exercisePrograms, workoutSchema, type Workout } from '../domain/activity'
import { dateLabel, localDate } from '../domain/dates'
import { activeDayNumber, planForDay } from '../domain/program'

const setup: Record<Workout['kind'], string[][]> = {
  А: [
    ['Поставьте устойчивый стул у стены. Стопы на ширине плеч.', 'Отведите таз назад и мягко коснитесь сиденья.', 'Встаньте, опираясь на всю стопу.'],
    ['Встаньте ровно, гантели по бокам, локти около корпуса.', 'Согните руки без раскачивания.', 'Медленно опустите гантели.'],
    ['Встаньте лицом к стене, ладони на уровне плеч.', 'Согните локти, приближая грудь к стене.', 'Оттолкнитесь ладонями и вернитесь в исходное положение.'],
    ['Поднимите гантели к плечам и поставьте стопы устойчиво.', 'Выжмите гантели вверх, сохраняя положение корпуса.', 'Плавно верните гантели к плечам.'],
    ['Встаньте рядом с устойчивой опорой.', 'Поднимите пятки, сохраняя равновесие.', 'Плавно опустите пятки.'],
  ],
  Б: [
    ['Лягте на спину. Согните колени, поставьте стопы на пол.', 'Поднимите таз, опираясь на стопы.', 'Опустите таз. Движение должно быть комфортным.'],
    ['Опритесь свободной рукой на устойчивую поверхность.', 'Подтяните локоть с гантелью к боку, сохраняя спину ровной.', 'Медленно опустите гантель. Выполните на обе стороны.'],
    ['Сядьте устойчиво и поставьте обе стопы на пол.', 'Плавно выпрямите одну ногу.', 'Опустите ногу. Повторите на второй стороне.'],
    ['Встаньте на четвереньки, ладони под плечами.', 'Вытяните противоположные руку и ногу на удобную высоту.', 'Вернитесь в исходное положение и смените сторону.'],
    ['Встаньте устойчиво, слегка согните локти.', 'Поднимите руки в стороны без рывка до комфортной высоты.', 'Плавно опустите руки.'],
  ],
}

export function Workouts() {
  const history = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), [], [])
  const days = useLiveQuery(() => db.days.toArray(), [], [])
  const program = useLiveQuery(() => db.programs.get('program'))
  const profile = useLiveQuery(() => db.profiles.get('profile'))
  const length = profile?.programDays ?? 21
  const number = activeDayNumber(days, length)
  const scheduled = program && number ? planForDay(number, profile?.autoPlan).kind : ''
  const [preparing, setPreparing] = useState<Workout['kind']>()
  const [deadline, setDeadline] = useState<number>()
  const [seconds, setSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const active = history.find((row) => !row.finished)
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
    if (!preparing) return
    const kind = preparing
    const record: Workout = { id: crypto.randomUUID(), date: localDate(), kind, finished: false, restSeconds: 75,
      exercises: exercisePrograms[kind].map((row) => ({ ...row, reps: [null, null] })),
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
    <header className="page-heading"><h1>Тренировки</h1><Link to="/treadmill" className="secondary w-fit">Беговая дорожка</Link></header>
    {!active && !preparing && <section className="panel form-grid"><h2>Выберите программу</h2>
      {scheduled && <p>По плану сегодня · тренировка {scheduled}</p>}
      <button className="action" onClick={() => setPreparing('А')}>Начать программу А</button>
      <button className="secondary" onClick={() => setPreparing('Б')}>Начать программу Б</button>
      <p className="muted">Стартовый режим · два подхода к каждому упражнению. Используйте комфортную нагрузку.</p>
    </section>}
    {!active && preparing && <section className="panel form-grid"><h2>Программа {preparing} · разминка</h2>
      <ol className="list-decimal ps-6"><li>Начните с лёгкой ходьбы на месте.</li><li>Добавьте плавные движения плечами, руками и ногами.</li><li>Постепенно разогрейтесь в комфортном темпе.</li></ol>
      {deadline && <p role="timer">{seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Время вышло'}</p>}
      {!deadline && <button className="secondary" onClick={() => timer(300)}>Запустить таймер · 5 мин</button>}
      <button className="action" disabled={busy} onClick={() => void start()}>Разминка выполнена</button>
      <button className="secondary" onClick={() => { clearTimer(); setPreparing(undefined) }}>Назад</button>
    </section>}
    {active && exercise && seconds > 0 && <section className="panel form-grid"><h2>Отдых между подходами</h2><p role="timer">{seconds} сек</p><p>Дождитесь, пока дыхание станет спокойнее.</p><button className="secondary" onClick={clearTimer}>Я готов продолжать</button></section>}
    {active && exercise && seconds === 0 && <form key={exerciseIndex + '-' + setIndex} className="panel form-grid" onSubmit={saveSet}>
      <h2>{exercise.name}</h2>
      <p className="muted">Программа {active.kind} · упражнение {exerciseIndex + 1} из {active.exercises.length} · подход {setIndex + 1} из {exercise.reps.length}</p>
      <ExercisePose name={exercise.name} />
      <ol className="list-decimal ps-6">{(exercisePrograms[active.kind][exerciseIndex]?.name === exercise.name ? setup[active.kind][exerciseIndex] ?? [exercise.technique] : [exercise.technique]).map((step) => <li key={step}>{step}</li>)}</ol>
      <p>Ориентир · {exercise.target} повторений.</p>
      <label>Сколько получилось<input name="reps" type="number" min="0" max="200" required /></label>
      <button className="action" disabled={busy}>Записать подход</button>
      <button className="secondary" type="button" disabled={busy} onClick={() => { if (window.confirm('Завершить и оставить записанные подходы?')) void finish() }}>Закончить раньше</button>
    </form>}
    {active && !exercise && <section className="panel form-grid"><h2>Все подходы записаны</h2><button className="action" disabled={busy} onClick={() => void finish()}>Завершить тренировку</button></section>}
    <p className="section-gap muted">При боли в груди, головокружении или необычной одышке остановитесь.</p>
    <p role="status">{message}</p>
    <section className="panel section-gap"><h2>История</h2>
      {history.some((row) => row.finished) ? <ul className="record-list">{history.filter((row) => row.finished).map((row) => <li key={row.id}>
        <details><summary>{dateLabel(row.date)} · программа {row.kind}</summary><ul>{row.exercises.map((item, index) => <li key={index}>{item.name} · {item.reps.map((reps) => reps ?? '—').join(' / ')}</li>)}</ul></details>
      </li>)}</ul> : <p className="muted">Завершённых тренировок пока нет.</p>}
    </section>
  </>
}
