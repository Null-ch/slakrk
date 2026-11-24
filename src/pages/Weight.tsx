import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { db, defaultProfile, weightSchema, type Weight as Measurement } from '../db/database'
import { addDays, dateLabel, localDate } from '../domain/dates'

const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 })

export function Weight() {
  const entries = useLiveQuery(() => db.weights.orderBy('date').reverse().toArray(), [], [])
  const profile = useLiveQuery(() => db.profiles.get('profile')) ?? defaultProfile
  const [editing, setEditing] = useState<Measurement>()
  const [message, setMessage] = useState('')
  const today = localDate()
  const recent = entries.filter(({ date }) => date >= addDays(today, -6) && date <= today)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const result = weightSchema.safeParse({ date: data.get('date'), kg: Number(data.get('kg')), waistCm: data.get('waist') ? Number(data.get('waist')) : undefined })
    if (!result.success || result.data.date > today) { setMessage('Проверьте дату и измерения.'); return }
    const entry = result.data
    try {
      await db.transaction('rw', db.weights, async () => {
        if (editing?.date === entry.date) await db.weights.put(entry)
        else {
          await db.weights.add(entry)
          if (editing) await db.weights.delete(editing.date)
        }
      })
      setEditing(undefined)
      form.reset()
      setMessage('Измерение сохранено.')
    } catch (error) {
      setMessage(error instanceof Error && error.name === 'ConstraintError' ? 'На эту дату уже есть измерение.' : 'Не удалось сохранить измерение.')
    }
  }

  async function remove(date: string) {
    if (!window.confirm('Удалить измерение?')) return
    try {
      await db.weights.delete(date)
      if (editing?.date === date) setEditing(undefined)
      setMessage('Измерение удалено.')
    } catch { setMessage('Не удалось удалить измерение.') }
  }

  return <>
    <header className="page-heading"><h1>Дневник веса</h1><p className="muted">Для сопоставимости записывай вес утром до завтрака.</p></header>
    <form key={editing?.date ?? 'new'} className="panel form-grid" onSubmit={save}>
      <h2>{editing ? 'Изменить измерение' : 'Добавить измерение'}</h2>
      <label>Дата<input name="date" type="date" required max={today} defaultValue={editing?.date ?? today} /></label>
      <label>Вес, кг<input name="kg" type="number" min="1" max="1000" step="any" required defaultValue={editing?.kg} /></label>
      <label>Талия, см<input name="waist" type="number" min="1" max="500" step="any" defaultValue={editing?.waistCm} /></label>
      <button className="action" type="submit">Сохранить измерение</button>
      {editing && <button type="button" className="secondary" onClick={() => setEditing(undefined)}>Отменить редактирование</button>}
      <p role="status">{message}</p>
    </form>
    <section className="panel section-gap">
      <h2>История</h2>
      {recent.length > 0 && <p>Среднее за 7 дней · {number.format(recent.reduce((sum, row) => sum + row.kg, 0) / recent.length)} кг</p>}
      {entries[0] && <p>От старта · {number.format(entries[0].kg - profile.startingWeightKg)} кг</p>}
      {entries.length === 0 ? <p className="muted">Добавь первое измерение.</p> : <ul className="record-list">
        {entries.map((entry) => <li key={entry.date}>
          <div><strong>{number.format(entry.kg)} кг</strong><p>{dateLabel(entry.date)}{entry.waistCm && ` · талия ${number.format(entry.waistCm)} см`}</p></div>
          <div className="inline-actions"><button className="secondary" onClick={() => setEditing(entry)}>Изменить</button><button className="secondary" onClick={() => void remove(entry.date)}>Удалить</button></div>
        </li>)}
      </ul>}
    </section>
  </>
}
