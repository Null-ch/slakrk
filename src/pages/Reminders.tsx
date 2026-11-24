import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { db } from '../db/database'
import { download } from '../domain/backup'
import { localDate } from '../domain/dates'
import { reminderCalendar, reminderNames, reminderSchema } from '../domain/reminders'

export function ReminderBanner() {
  const reminders = useLiveQuery(() => db.reminders.toArray(), [], [])
  const [clock, setClock] = useState(() => new Date())
  const [dismissed, setDismissed] = useState<string[]>([])
  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 10000)
    return () => window.clearInterval(interval)
  }, [])
  const time = clock.toTimeString().slice(0, 5)
  const key = localDate(clock) + time
  const due = reminders.filter((item) => item.enabled && item.time === time && !dismissed.includes(key + item.id))
  return due.length ? <aside className="panel mb-4" aria-live="polite">
    {due.map((item) => <div key={item.id} className="inline-actions items-center"><strong>Напоминание · {item.id}</strong><button className="secondary" onClick={() => setDismissed([...dismissed, key + item.id])}>Закрыть</button></div>)}
  </aside> : null
}

export function Reminders() {
  const stored = useLiveQuery(() => db.reminders.toArray())
  const [message, setMessage] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    try {
      await db.reminders.bulkPut(reminderNames.map((id) => reminderSchema.parse({ id, enabled: fields.has(id), time: fields.get(id + '-time') })))
      setMessage('Напоминания сохранены.')
    } catch { setMessage('Проверьте время напоминаний.') }
  }
  return <>
    <header className="page-heading"><h1>Напоминания</h1><p className="muted">Приложение показывает напоминания, пока оно открыто. Для системных уведомлений добавь события в календарь.</p></header>
    {stored && <form className="panel form-grid" onSubmit={save}>
      {reminderNames.map((id) => {
        const row = stored.find((item) => item.id === id)
        return <div key={id} className="grid grid-cols-[1fr_7rem] items-center gap-2">
          <label className="!flex items-center"><input className="!w-5" name={id} type="checkbox" defaultChecked={row?.enabled} />{id}</label>
          <input type="time" aria-label={`Время · ${id}`} name={id + '-time'} defaultValue={row?.time ?? '09:00'} required />
        </div>
      })}
      <button className="action">Сохранить напоминания</button>
      <button className="secondary" type="button" disabled={!stored.some((row) => row.enabled)} onClick={() => download('stop-jir-reminders.ics', reminderCalendar(stored), 'text/calendar;charset=utf-8')}>Скачать события календаря</button>
    </form>}
    <p role="status" className="section-gap">{message}</p>
  </>
}
