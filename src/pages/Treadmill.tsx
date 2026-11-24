import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { db } from '../db/database'
import { monday, walkSchema } from '../domain/activity'
import { addDays, dateLabel, localDate } from '../domain/dates'
import { nutritionNumber } from '../domain/nutrition'

export function Treadmill() {
  const rows = useLiveQuery(() => db.walks.orderBy('date').reverse().toArray(), [], [])
  const [message, setMessage] = useState('')
  const current = monday(localDate())
  const week = rows.filter(({ date }) => date >= current && date <= localDate())
  const lastWeek = rows.filter(({ date }) => date >= addDays(current, -7) && date < current)
  const minutes = (records: typeof rows) => records.reduce((sum, row) => sum + row.minutes, 0)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const duration = Number(data.get('minutes'))
    const speed = Number(data.get('speed'))
    const result = walkSchema.safeParse({ id: crypto.randomUUID(), date: data.get('date'), minutes: duration, speed,
      incline: Number(data.get('incline')), distance: data.get('distance') ? Number(data.get('distance')) : speed * duration / 60,
      effort: data.get('effort'), comment: data.get('comment'),
    })
    if (!result.success) { setMessage('Проверьте параметры записи.'); return }
    try { await db.walks.add(result.data); form.reset(); setMessage('Ходьба записана.') }
    catch { setMessage('Не удалось сохранить запись.') }
  }

  return <>
    <header className="page-heading"><h1>Беговая дорожка</h1></header>
    <section className="panel"><h2>На этой неделе</h2><p>{nutritionNumber.format(minutes(week))} мин · {nutritionNumber.format(week.reduce((sum, row) => sum + row.distance, 0))} км</p><p className="muted">Предыдущая неделя · {nutritionNumber.format(minutes(lastWeek))} мин</p></section>
    <form className="panel form-grid section-gap" onSubmit={save}>
      <h2>Записать ходьбу</h2>
      <label>Дата<input name="date" type="date" defaultValue={localDate()} max={localDate()} required /></label>
      <label>Продолжительность, мин<input name="minutes" type="number" min="0.1" step="any" required /></label>
      <label>Скорость, км/ч<input name="speed" type="number" min="0.1" step="any" required /></label>
      <label>Наклон, %<input name="incline" type="number" min="0" max="100" step="any" defaultValue="0" required /></label>
      <label>Расстояние, км (или расчёт по скорости)<input name="distance" type="number" min="0.01" step="any" /></label>
      <label>Самочувствие<select name="effort"><option>Легко</option><option>Умеренно</option><option>Тяжело</option></select></label>
      <label>Комментарий<textarea name="comment" /></label>
      <button className="action">Сохранить ходьбу</button><p role="status">{message}</p>
    </form>
    <section className="panel section-gap"><h2>История ходьбы</h2>
      {rows.length === 0 ? <p className="muted">Записей пока нет.</p> : <ul className="record-list">{rows.map((row) => <li key={row.id}>
        <div><strong>{dateLabel(row.date)} · {row.minutes} мин</strong><p>{nutritionNumber.format(row.distance)} км · {row.speed} км/ч · наклон {row.incline}% · {row.effort}</p>{row.comment && <p>{row.comment}</p>}</div>
        <button className="secondary" onClick={() => { if (window.confirm('Удалить запись ходьбы?')) void db.walks.delete(row.id).catch(() => setMessage('Не удалось удалить запись.')) }}>Удалить</button>
      </li>)}</ul>}
    </section>
  </>
}
