import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, defaultProfile } from '../db/database'
import { addDays, dateLabel, localDate } from '../domain/dates'
import { plannedMenu } from '../domain/personalPlan'
import { mealKinds, nutrientKeys, nutrientLabels, nutritionNumber, scaleNutrients, sumNutrients, type Meal } from '../domain/nutrition'

export function Nutrition() {
  const [date, setDate] = useState(localDate)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const profile = useLiveQuery(() => db.profiles.get('profile')) ?? defaultProfile
  const products = useLiveQuery(() => db.products.toArray(), [], [])
  const entries = useLiveQuery(() => db.meals.where('date').equals(date).toArray(), [date], [])
  const override = useLiveQuery(() => db.menuOverrides.get(date), [date])
  const menu = override?.meals ?? plannedMenu(date, profile.autoPlan ? profile.goals.calories : undefined)
  const plannedRows = menu.map((items, group) => items.map((item, index) => ({
    ...item,
    id: `plan-${date}-${group}-${index}`,
    per100g: products.find((product) => product.name === item.name)?.per100g,
  })))
  const totals = sumNutrients(entries.map((item) => scaleNutrients(item.per100g, item.grams / 100)))
  const known = plannedRows.flat().flatMap((item) => item.grams && item.per100g ? [scaleNutrients(item.per100g, item.grams / 100)] : [])
  const complete = known.length === plannedRows.flat().length
  const planned = sumNutrients(known)
  const currentIds = new Set(entries.map(({ id }) => id))
  const plannedIds = new Set(plannedRows.flat().map(({ id }) => id))
  const otherEntries = entries.filter(({ id }) => !plannedIds.has(id))

  async function mark(rows: Meal[], remove: boolean) {
    setSaving(true)
    try {
      if (remove) await db.meals.bulkDelete(rows.map(({ id }) => id))
      else await db.meals.bulkPut(rows)
      setMessage('')
    } catch { setMessage('Не удалось сохранить отметку.') }
    finally { setSaving(false) }
  }

  return <>
    <header className="page-heading"><h1>Питание</h1></header>
    <section className="panel form-grid">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="secondary" onClick={() => setDate(addDays(date, -1))}>Предыдущий день</button>
        <strong>{dateLabel(date)}</strong>
        <button className="secondary" onClick={() => setDate(addDays(date, 1))}>Следующий день</button>
      </div>
      <p className="metric">{nutritionNumber.format(totals.calories)} <small>из {profile.goals.calories} ккал</small></p>
      <p>{complete ? 'В меню' : 'Известная часть меню'} · ≈{nutritionNumber.format(planned.calories)} ккал</p>
      {profile.estimatedMaintenance && <p className="muted">Расчётный расход · {profile.estimatedMaintenance} ккал · {profile.estimatedMaintenance > profile.goals.calories ? `дефицит ≈${profile.estimatedMaintenance - profile.goals.calories} ккал` : 'без дефицита'}</p>}
      <details><summary>Белки, жиры и углеводы</summary>{nutrientKeys.slice(1).map((key) => <p key={key}>{nutrientLabels[key]} · {nutritionNumber.format(totals[key])} / {nutritionNumber.format(profile.goals[key])}</p>)}</details>
      <p role="status">{message}</p>
    </section>
    {plannedRows.map((items, group) => {
      const meal = mealKinds[group]
      if (!meal) return null
      const rows = items.flatMap((item) => item.grams && item.per100g ? [{ id: item.id, date, meal, name: item.name, grams: item.grams, per100g: item.per100g }] : [])
      const allMarked = rows.length > 0 && rows.every(({ id }) => currentIds.has(id))
      return <section className="panel section-gap" key={meal}>
        <h2>{meal}</h2>
        <ul className="record-list">{items.map((item) => {
          const row = rows.find(({ id }) => id === item.id)
          return <li key={item.id}><div><strong>{item.name}</strong><p className="muted">{item.grams ? `${item.grams} г` : item.units ? `${item.units} шт.` : 'Порция не задана'}
            {row ? ` · ≈${nutritionNumber.format(row.grams * row.per100g.calories / 100)} ккал` : ' · без расчёта'}</p></div>
            {row && <label className="flex items-center gap-2"><input type="checkbox" disabled={saving} checked={currentIds.has(item.id)} onChange={(event) => void mark([row], !event.target.checked)} /><span>Съедено</span></label>}
          </li>
        })}</ul>
        {rows.length > 0 && <button type="button" disabled={saving} className="secondary section-gap" onClick={() => void mark(rows, allMarked)}>{allMarked ? 'Снять отметки' : rows.length === items.length ? 'Отметить весь приём' : 'Отметить позиции с расчётом'}</button>}
      </section>
    })}
    {otherEntries.length > 0 && <section className="panel section-gap"><h2>Ранее записано</h2>
      <ul className="record-list">{otherEntries.map((entry) => <li key={entry.id}>{entry.name} · {entry.grams} г<button className="secondary" disabled={saving} onClick={() => void mark([entry], true)}>Удалить</button></li>)}</ul>
    </section>}
  </>
}
