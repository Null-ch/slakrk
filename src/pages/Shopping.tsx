import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { db, defaultProfile } from '../db/database'
import { plannedMenu } from '../domain/personalPlan'
import { addDays, localDate } from '../domain/dates'
import { monday } from '../domain/activity'
import { shoppingSchema, type ShoppingItem } from '../domain/program'

export function Shopping() {
  const [week, setWeek] = useState(1)
  const [message, setMessage] = useState('')
  const program = useLiveQuery(() => db.programs.get('program'))
  const profile = useLiveQuery(() => db.profiles.get('profile')) ?? defaultProfile
  const length = profile.programDays
  const changes = useLiveQuery(() => db.shopping.where('week').equals(week).toArray(), [week], [])
  const existing = new Map(changes.map((item) => [item.id, item]))
  const start = addDays(program?.started ?? monday(localDate()), (week - 1) * 7)
  const overrides = useLiveQuery(() => db.menuOverrides.where('date').between(start, addDays(start, 6), true, true).toArray(), [start], [])
  const generated = new Map<string, ShoppingItem>()

  for (let offset = 0; offset < Math.min(7, length - (week - 1) * 7); offset++) {
    const date = addDays(start, offset)
    for (const item of (overrides.find((row) => row.date === date)?.meals ?? plannedMenu(date, profile.autoPlan ? profile.goals.calories : undefined)).flat()) {
      const id = 'menu-' + week + '-' + item.name
      const current = generated.get(id)
      generated.set(id, {
        id, week, name: item.name, category: item.category,
        grams: (current?.grams ?? 0) + (item.grams ?? 0) || undefined,
        units: (current?.units ?? 0) + (item.units ?? 0) || undefined,
        unspecified: current?.unspecified || (!item.grams && !item.units),
        bought: existing.get(id)?.bought ?? false, removed: existing.get(id)?.removed,
      })
    }
  }
  const items = [...generated.values(), ...changes.filter(({ id }) => !id.startsWith('menu-'))].filter(({ removed }) => !removed)
  const categories = [...new Set(items.map(({ category }) => category))]

  async function write(item: ShoppingItem) {
    try { await db.shopping.put(shoppingSchema.parse(item)); setMessage('Список сохранён.') }
    catch { setMessage('Проверьте название и количество.') }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const result = shoppingSchema.safeParse({ id: crypto.randomUUID(), week, name: String(data.get('name')).trim(), category: 'Прочее', bought: false, grams: data.get('grams') ? Number(data.get('grams')) : undefined })
    if (!result.success) { setMessage('Проверьте название и массу.'); return }
    await write(result.data)
    form.reset()
  }

  return <>
    <header className="page-heading"><h1>Покупки</h1><p className="muted">Количество по базовому меню. Для позиций без массы уточни порцию.</p></header>
    <div className="panel form-grid"><label>Неделя<select value={week} onChange={(event) => setWeek(Number(event.target.value))}>
      {Array.from({ length: Math.ceil(length / 7) }, (_, index) => <option key={index} value={index + 1}>Неделя {index + 1}</option>)}
    </select></label></div>
    <form className="panel form-grid section-gap" onSubmit={add}>
      <h2>Добавить позицию</h2><label>Название<input name="name" required /></label>
      <label>Масса, г<input name="grams" type="number" min="0.1" step="any" /></label>
      <button className="action">Добавить покупку</button>
      {changes.some(({ removed }) => removed) && <button className="secondary" type="button" onClick={() => void db.shopping.bulkDelete(changes.filter(({ removed }) => removed).map(({ id }) => id)).catch(() => setMessage('Не удалось восстановить позиции.'))}>Вернуть удалённые позиции меню</button>}
      <p role="status">{message}</p>
    </form>
    {categories.map((category) => <section className="panel section-gap" key={category}><h2>{category}</h2>
      <ul className="record-list">{items.filter((item) => item.category === category).map((item) => <li key={item.id}>
        <label className="flex items-center gap-2"><input type="checkbox" checked={item.bought} onChange={(event) => void write({ ...item, bought: event.target.checked })} />
          <span>{item.name}{item.grams ? ` · ${item.grams} г` : ''}{item.units ? ` · ${item.units} шт.` : ''}{item.unspecified ? ' · уточни количество' : ''}</span></label>
        <button className="secondary" onClick={() => { if (item.id.startsWith('menu-')) void write({ ...item, removed: true }); else void db.shopping.delete(item.id).catch(() => setMessage('Не удалось удалить позицию.')) }}>Удалить</button>
      </li>)}</ul>
    </section>)}
  </>
}
