import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { db, defaultProfile } from '../db/database'
import { addDays, dateLabel, localDate } from '../domain/dates'
import { activeDayNumber, daySchema, isClosed, planForDay, taskKeys, taskNames, type ProgramDay } from '../domain/program'

export function Calendar() {
  const program = useLiveQuery(() => db.programs.get('program'))
  const days = useLiveQuery(() => db.days.toArray(), [], [])
  const length = useLiveQuery(() => db.profiles.get('profile'))?.programDays ?? defaultProfile.programDays
  const [selected, setSelected] = useState<number>()
  const [message, setMessage] = useState('')
  const active = activeDayNumber(days, length)
  const number = selected ?? active
  const entry = days.find((day) => day.number === number)
  const activity = number ? planForDay(number) : undefined
  const today = localDate()

  async function start() {
    try { await db.programs.add({ id: 'program', started: today }); setMessage('Программа начата.') }
    catch { setMessage('Не удалось начать программу.') }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!number || !program || addDays(program.started, number - 1) > today) return
    const fields = new FormData(event.currentTarget)
    const status = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') ?? 'В процессе'
    const result = daySchema.safeParse({ number, date: entry?.date ?? today, status,
      tasks: Object.fromEntries(taskKeys.map((key) => [key, fields.has(key)])),
      minutes: String(fields.get('minutes') ?? ''), speed: String(fields.get('speed') ?? ''), incline: String(fields.get('incline') ?? ''),
    })
    if (!result.success) { setMessage('Не удалось проверить день.'); return }
    try { await db.days.put(result.data); if (isClosed(result.data)) setSelected(undefined); setMessage('День сохранён.') }
    catch { setMessage('Не удалось сохранить день.') }
  }

  return <>
    <header className="page-heading"><h1>Календарь</h1><p className="muted">Пропущенная дата не закрывает день программы автоматически.</p></header>
    {!program ? <section className="panel"><h2>Программа на {length} день</h2><button className="action" onClick={() => void start()}>Начать программу</button></section> : <>
      <section className="panel"><h2>Дни программы</h2><p>Старт · {dateLabel(program.started)} · закрыто {days.filter(isClosed).length} из {length}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7 section-gap">
          {Array.from({ length }, (_, i) => {
            const day = days.find((row) => row.number === i + 1)
            return <button key={i} type="button" className="secondary text-sm" aria-pressed={number === i + 1} disabled={!day && (active == null || i + 1 > active)} onClick={() => setSelected(i + 1)}>
              <strong className="block">День {i + 1}</strong>{day?.status ?? (active === i + 1 ? 'Текущий' : 'Не начат')}
            </button>
          })}
        </div>
      </section>
      {number && addDays(program.started, number - 1) > today && <p className="panel section-gap">День {number} по календарю наступит {dateLabel(addDays(program.started, number - 1))}.</p>}
      {number && activity && addDays(program.started, number - 1) <= today && <form key={number + '-' + (entry?.status ?? 'new')} className="panel form-grid section-gap" onSubmit={save}>
        <h2>День {number}</h2>
        <p>По календарю · {dateLabel(addDays(program.started, number - 1))}{entry ? ' · запись ' + dateLabel(entry.date) : ''}</p>
        <p>{activity.kind ? 'Силовая ' + activity.kind : activity.minutes ? 'Дорожка' : 'День отдыха'}{number === 21 ? ' и контроль результатов' : ''}</p>
        {taskKeys.filter((key) => key === 'nutrition' || key === 'weight' || (key === 'walking' && Boolean(activity.minutes)) || (key === 'workout' && Boolean(activity.kind))).map((key) =>
          <label key={key} className="!flex items-center"><input className="!w-5" type="checkbox" name={key} defaultChecked={entry?.tasks[key]} />{taskNames[key]}{key === 'weight' ? ' (по желанию)' : ''}</label>)}
        {activity.minutes && <>
          <label>Ходьба, мин<input name="minutes" defaultValue={entry?.minutes ?? activity.minutes} /></label>
          <label>Скорость, км/ч<input name="speed" defaultValue={entry?.speed ?? activity.speed} /></label>
          <label>Наклон, %<input name="incline" defaultValue={entry?.incline ?? activity.incline} /></label>
          <p className="muted">При сильной усталости снизь нагрузку. При боли остановись.</p>
        </>}
        <button className="action" value={entry?.status ?? 'В процессе'}>Сохранить чек-лист</button>
        <div className="inline-actions">
          {(['Выполнен', 'Частично выполнен', 'Пропущен'] as ProgramDay['status'][]).map((status) => <button key={status} className="secondary" value={status}>{status}</button>)}
        </div>
      </form>}
    </>}
    <p role="status" className="section-gap">{message}</p>
  </>
}
