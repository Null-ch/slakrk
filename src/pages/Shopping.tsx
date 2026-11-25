import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { db, defaultProfile } from '../db/database'
import { plannedMenu } from '../domain/personalPlan'
import { addDays, dateLabel, localDate } from '../domain/dates'
import { monday } from '../domain/activity'
import { shoppingSchema, type ShoppingItem } from '../domain/program'

export function Shopping() {
  const [selectedWeek, setWeek] = useState(1)
  const program = useLiveQuery(() => db.programs.get('program'))
  const profile = useLiveQuery(() => db.profiles.get('profile')) ?? defaultProfile
  const length = profile.programDays
  const weeks = Math.ceil(length / 7)
  const week = Math.min(selectedWeek, weeks)

  return <>
    <header className="page-heading"><h1>Покупки</h1></header>
    <ShoppingWeek key={week} week={week} weeks={weeks} length={length} start={addDays(program?.started ?? monday(localDate()), (week - 1) * 7)} profile={profile} setWeek={setWeek} />
  </>
}

function ShoppingWeek({ week, weeks, length, start, profile, setWeek }: { week: number; weeks: number; length: number; start: string; profile: typeof defaultProfile; setWeek: (week: number) => void }) {
  const [feedback, setFeedback] = useState<{ text: string; error?: true }>()
  const locks = useRef(new Set<string>())
  const [pending, setPending] = useState(new Set<string>())
  const loadedChanges = useLiveQuery(() => db.shopping.where('week').equals(week).toArray(), [week])
  const changes = loadedChanges ?? []
  const existing = new Map(changes.map((item) => [item.id, item]))
  const days = Math.min(7, length - (week - 1) * 7)
  const end = addDays(start, days - 1)
  const overrides = useLiveQuery(() => db.menuOverrides.where('date').between(start, end, true, true).toArray(), [start, end])
  const generated = new Map<string, ShoppingItem>()

  for (let offset = 0; offset < days; offset++) {
    const date = addDays(start, offset)
    for (const item of (overrides?.find((row) => row.date === date)?.meals ?? plannedMenu(date, (profile.autoPlan || profile.appliedMenu) ? profile.goals.calories : undefined, profile.appliedMenu)).flat()) {
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

  const ready = Boolean(loadedChanges && overrides)
  const bought = items.filter((item) => item.bought).length
  const removed = changes.filter((item) => item.removed && item.id.startsWith('menu-'))

  async function persist(key: string, operation: () => Promise<unknown>, success: string) {
    if (locks.current.has(key)) return false
    locks.current.add(key)
    setPending(new Set(locks.current))
    try {
      await operation()
      setFeedback({ text: success })
      return true
    } catch {
      setFeedback({ text: 'Не удалось сохранить изменение. Повторите попытку.', error: true })
      return false
    } finally {
      locks.current.delete(key)
      setPending(new Set(locks.current))
    }
  }

  function update(item: ShoppingItem, patch: Partial<Pick<ShoppingItem, 'bought' | 'removed'>>) {
    return db.transaction('rw', db.shopping, async () => {
      const saved = await db.shopping.get(item.id)
      if (!saved && !generated.has(item.id)) return
      await db.shopping.put(shoppingSchema.parse({ ...item, ...saved, ...patch }))
    })
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const result = shoppingSchema.safeParse({
      id: crypto.randomUUID(), week, name: String(data.get('name')).trim(), category: 'Прочее',
      bought: false, grams: data.get('grams') ? Number(data.get('grams')) : undefined,
    })
    if (!result.success) {
      setFeedback({ text: 'Проверьте название и массу.', error: true })
      return
    }
    if (await persist('add', () => db.shopping.add(result.data), 'Позиция добавлена.')) form.reset()
  }

  return <>
    <section className="panel shopping-summary">
      <label className="form-grid shopping-week">Неделя программы<select value={week} onChange={(event) => setWeek(Number(event.target.value))}>
        {Array.from({ length: weeks }, (_, index) => <option key={index} value={index + 1}>Неделя {index + 1}</option>)}
      </select></label>
      <div className="shopping-progress">
        <p className="muted">{dateLabel(start)} · {dateLabel(end)}</p>
        <p><strong>{bought} из {items.length}</strong> куплено</p>
        <progress aria-label="Куплено позиций" max={items.length || 1} value={bought} />
      </div>
    </section>
    <form className="panel shopping-add form-grid section-gap" onSubmit={add}>
      <h2>Добавить позицию</h2>
      <div className="shopping-fields">
        <label>Название<input name="name" required placeholder="Например, помидоры" /></label>
        <label>Масса, г<input name="grams" type="number" inputMode="decimal" min="0.1" step="any" placeholder="По желанию" /></label>
      </div>
      <button className="action shopping-add-button" disabled={!ready || pending.has('add')}><Plus size={18} aria-hidden="true" /> Добавить</button>
    </form>
    <p className="shopping-feedback" role="status" data-error={feedback?.error}>{feedback?.text}</p>
    {!ready ? <p role="status">Загружаем список…</p> : !items.length && <p className="panel section-gap">В этой неделе пока нет покупок.</p>}
    {ready && categories.map((category) => <section className="panel shopping-category section-gap" key={category}>
      <h2>{category}</h2>
      <ul>{items.filter((item) => item.category === category).map((item) => <li className="shopping-item" key={item.id} data-bought={item.bought}>
        <label className="shopping-toggle">
          <input type="checkbox" checked={item.bought} disabled={pending.has(item.id)} onChange={(event) => {
            const checked = event.target.checked
            void persist(item.id, () => update(item, { bought: checked }), checked ? 'Отмечено как купленное.' : 'Отметка снята.')
          }} />
          <span className="shopping-checkmark" aria-hidden="true"><Check size={17} strokeWidth={3} /></span>
          <span className="shopping-item-copy">
            <span className="shopping-name">{item.name}</span>
            <span className="muted shopping-quantity">{[
              item.grams ? new Intl.NumberFormat('ru', { maximumFractionDigits: 2 }).format(item.grams) + ' г' : '',
              item.units ? item.units + ' шт.' : '',
              item.unspecified ? 'Уточнить количество' : '',
            ].filter(Boolean).join(' · ')}</span>
          </span>
        </label>
        <button className="shopping-remove" type="button" aria-label={'Удалить ' + item.name} disabled={pending.has(item.id)} onClick={() => {
          void persist(item.id, () => generated.has(item.id) ? update(item, { removed: true }) : db.shopping.delete(item.id), 'Позиция удалена.')
        }}><Trash2 size={18} aria-hidden="true" /></button>
      </li>)}</ul>
    </section>)}
    {removed.length > 0 && <button className="secondary section-gap" type="button" disabled={pending.has('restore')} onClick={() => {
      void persist('restore', () => db.shopping.where('id').anyOf(removed.map(({ id }) => id)).modify({ removed: false }), 'Позиции меню восстановлены.')
    }}>Вернуть удалённые позиции меню</button>}
  </>
}
