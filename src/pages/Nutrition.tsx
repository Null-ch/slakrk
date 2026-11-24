import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { db, defaultProfile } from '../db/database'
import { menuForDate, menuOverrideSchema } from '../data/meals'
import { addDays, localDate } from '../domain/dates'
import { mealKinds, mealSchema, nutrientKeys, nutrientLabels, nutritionNumber, productSchema, recipeNutrients, recipeSchema, scaleNutrients, sumNutrients, type Meal, type Nutrients, type Product } from '../domain/nutrition'

export function Nutrition() {
  const [date, setDate] = useState(localDate)
  const [meal, setMeal] = useState<Meal['meal']>(mealKinds[0])
  const [editing, setEditing] = useState<Meal>()
  const [draft, setDraft] = useState<{ name: string; grams?: number; per100g?: Nutrients }>()
  const [message, setMessage] = useState('')
  const products = useLiveQuery(() => db.products.orderBy('name').toArray(), [], [])
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), [], [])
  const entries = useLiveQuery(() => db.meals.where('date').equals(date).toArray(), [date], [])
  const goals = useLiveQuery(() => db.profiles.get('profile'))?.goals ?? defaultProfile.goals
  const override = useLiveQuery(() => db.menuOverrides.get(date), [date])
  const menu = override?.meals ?? menuForDate(date)
  const [editMenu, setEditMenu] = useState<number>()
  const totals = sumNutrients(entries.map((row) => scaleNutrients(row.per100g, row.grams / 100)))
  const planned = menu.flat().map((item) => ({ ...item, product: products.find(({ name }) => name === item.name) }))
  const known = planned.filter((item) => item.grams && item.product)
  const plannedTotals = sumNutrients(known.flatMap(({ grams, product }) => grams && product ? [scaleNutrients(product.per100g, grams / 100)] : []))

  function choose(entry: typeof draft, kind = meal) {
    setEditing(undefined)
    setDraft(entry && { ...entry })
    setMeal(kind)
    setMessage('')
    if (entry) document.getElementById('meal-entry')?.scrollIntoView()
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const per100g = Object.fromEntries(nutrientKeys.map((key) => [key, Number(fields.get(key))]))
    const result = mealSchema.safeParse({ id: editing?.id ?? crypto.randomUUID(), date, meal, name: fields.get('name'), grams: Number(fields.get('grams')), per100g })
    if (!result.success) { setMessage('Проверьте состав и массу.'); return }
    try {
      await db.transaction('rw', db.meals, db.products, async () => {
        await db.meals.put(result.data)
        if (fields.has('catalog')) {
          const old = await db.products.where('name').equals(result.data.name).first()
          await db.products.put(productSchema.parse({ id: old?.id ?? crypto.randomUUID(), name: result.data.name, per100g, source: 'Введено пользователем' }))
        }
      })
      setEditing(undefined)
      setDraft(undefined)
      form.reset()
      setMessage('Запись сохранена.')
    } catch { setMessage('Не удалось сохранить запись.') }
  }

  async function copy(source: string, target: string, kind?: Meal['meal']) {
    if (!source || !target || source === target) { setMessage('Выберите другую дату.'); return }
    try {
      const count = await db.transaction('rw', db.meals, async () => {
        const rows = (await db.meals.where('date').equals(source).toArray()).filter((row) => !kind || row.meal === kind)
        const existing = await db.meals.where('date').equals(target).toArray()
        const added = rows.filter((row) => !existing.some((other) => other.name === row.name && other.grams === row.grams && other.meal === row.meal))
        await db.meals.bulkAdd(added.map((row) => ({ ...row, date: target, id: crypto.randomUUID() })))
        return added.length
      })
      setMessage(count ? `Скопировано позиций: ${count}.` : 'Новых позиций для копирования нет.')
    } catch { setMessage('Не удалось скопировать рацион.') }
  }

  const recent = useLiveQuery(() => db.meals.orderBy('date').reverse().limit(25).toArray(), [], [])
  return <>
    <header className="page-heading"><h1>Питание</h1><p className="muted">Расчёты приблизительные. Сверяй пищевую ценность с упаковкой.</p></header>
    <div className="panel form-grid">
      <label>День<input type="date" value={date} onChange={(event) => { if (event.target.value) { setDate(event.target.value); choose(undefined) } }} /></label>
      {nutrientKeys.map((key) => <div key={key}>
        <p>{nutrientLabels[key]} · {nutritionNumber.format(totals[key])} / {goals[key]} · {Math.round(totals[key] / goals[key] * 100)}%</p>
        <progress className="w-full accent-emerald-700" aria-label={nutrientLabels[key]} max={goals[key]} value={Math.min(goals[key], totals[key])} />
      </div>)}
      <p>{totals.calories <= goals.calories ? 'Осталось' : 'Сверх цели'} {nutritionNumber.format(Math.abs(goals.calories - totals.calories))} ккал</p>
      <button className="secondary" onClick={() => void copy(addDays(date, -1), date)}>Повторить вчерашний рацион</button>
    </div>
    <section className="panel section-gap">
      <h2>Меню дня</h2>
      {override && <button className="secondary" onClick={() => void db.menuOverrides.delete(date).catch(() => setMessage('Не удалось восстановить меню.'))}>Вернуть базовое меню</button>}
      <p className="muted">Крупы в сухом виде, мясо и рыба сырые, овощи до приготовления.</p>
      <p>{known.length === planned.length ? 'Итог' : 'Итог по уточнённым позициям'} · {nutrientKeys.map((key) => nutritionNumber.format(plannedTotals[key])).join(' / ')} (ккал / Б / Ж / У)</p>
      <p>Разница с целями · {nutrientKeys.map((key) => nutritionNumber.format(plannedTotals[key] - goals[key])).join(' / ')}</p>
      {menu.map((items, index) => <div key={date + '-' + index} className="section-gap">
        <h3 className="font-semibold">{mealKinds[index]}{index === 0 && new Date(date + 'T12:00:00').getDay() === 3 ? ' · сырники в аэрогриле' : ''}</h3>
        <ul className="record-list">{items.map((item) => <li key={item.name}>
          <span>{item.name}{item.grams ? ` · ${item.grams} г` : item.units ? ` · ${item.units} шт.` : ' · уточни порцию'}</span>
          <button className="secondary" onClick={() => choose({ name: item.name, grams: item.grams, per100g: products.find(({ name }) => name === item.name)?.per100g }, mealKinds[index])}>В дневник</button>
        </li>)}</ul>
        <button type="button" className="secondary" onClick={() => setEditMenu(editMenu === index ? undefined : index)}>{editMenu === index ? 'Закрыть редактор' : 'Изменить меню'}</button>
        {editMenu === index && <MenuEditor items={items} onSave={async (next) => {
          const result = menuOverrideSchema.safeParse({ date, meals: menu.map((group, i) => i === index ? next : group) })
          if (!result.success) throw new Error('Проверьте строки меню.')
          await db.menuOverrides.put(result.data)
          setEditMenu(undefined)
        }} />}
      </div>)}
    </section>
    <form key={editing?.id ?? (draft ? JSON.stringify(draft) : 'new')} id="meal-entry" className="panel form-grid section-gap" onSubmit={save}>
      <h2>{editing ? 'Изменить позицию' : 'Записать еду'}</h2>
      <label>Приём пищи<select value={meal} onChange={(event) => setMeal(event.target.value as Meal['meal'])}>{mealKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label>
      <label>Продукт из справочника<select value="" onChange={(event) => { const product = products.find(({ id }) => id === event.target.value); if (product) choose({ ...product }) }}>
        <option value="">Выбрать продукт</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.source}</option>)}
      </select></label>
      <label>Рецепт<select value="" onChange={(event) => { const recipe = recipes.find(({ id }) => id === event.target.value); if (recipe) choose({ name: recipe.name, grams: recipe.yieldGrams / recipe.servings, per100g: scaleNutrients(recipeNutrients(recipe), 100 / recipe.yieldGrams) }) }}>
        <option value="">Выбрать рецепт</option>{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
      </select></label>
      {recent.length > 0 && <label>Недавние продукты<select value="" onChange={(event) => { const entry = recent.find(({ id }) => id === event.target.value); if (entry) choose({ ...entry }) }}><option value="">Выбрать запись</option>{recent.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.date}</option>)}</select></label>}
      <label>Название<input name="name" required defaultValue={draft?.name ?? editing?.name} /></label>
      <label>Масса, г<input name="grams" type="number" min="0.1" step="any" required defaultValue={draft?.grams ?? editing?.grams} /></label>
      {nutrientKeys.map((key) => <label key={key}>{nutrientLabels[key]} на 100 г<input name={key} type="number" min="0" step="any" required defaultValue={(draft?.per100g ?? editing?.per100g)?.[key]} /></label>)}
      <label className="!flex items-center"><input className="!w-5" type="checkbox" name="catalog" /> Сохранить или обновить продукт в справочнике</label>
      <button className="action">Сохранить еду</button>
      {(editing || draft) && <button className="secondary" type="button" onClick={() => choose(undefined)}>Очистить форму</button>}
      <p role="status">{message}</p>
    </form>
    {mealKinds.map((kind) => {
      const rows = entries.filter((entry) => entry.meal === kind)
      return <section className="panel section-gap" key={kind}><h2>{kind}</h2>
        {rows.length === 0 ? <p className="muted">Записей пока нет.</p> : <>
          <ul className="record-list">{rows.map((row) => <li key={row.id}>
            <span>{row.name} · {row.grams} г · {nutritionNumber.format(row.per100g.calories * row.grams / 100)} ккал</span>
            <div className="inline-actions"><button className="secondary" onClick={() => { setDraft(undefined); setEditing(row); setMeal(kind); document.getElementById('meal-entry')?.scrollIntoView() }}>Изменить</button><button className="secondary" onClick={() => void db.meals.delete(row.id).catch(() => setMessage('Не удалось удалить запись.'))}>Удалить</button></div>
          </li>)}</ul>
          <form className="form-grid section-gap" onSubmit={(event) => { event.preventDefault(); void copy(date, String(new FormData(event.currentTarget).get('target')), kind) }}><label>Копировать на дату<input name="target" type="date" required /></label><button className="secondary">Копировать {kind.toLowerCase()}</button></form>
        </>}
      </section>
    })}
    <RecipeEditor products={products} />
  </>
}

function MenuEditor({ items, onSave }: { items: ReturnType<typeof menuForDate>[number]; onSave: (items: ReturnType<typeof menuForDate>[number]) => Promise<void> }) {
  const [rows, setRows] = useState(items)
  const [error, setError] = useState('')
  const categories = ['Мясо и птица', 'Рыба', 'Молочные продукты', 'Яйца', 'Крупы и макароны', 'Овощи', 'Фрукты', 'Орехи и масла', 'Прочее']
  function change(index: number, value: Partial<(typeof rows)[number]>) {
    setRows(rows.map((row, i) => i === index ? { ...row, ...value } : row))
  }
  return <form className="form-grid section-gap" onSubmit={(event) => {
    event.preventDefault()
    void onSave(rows).catch(() => setError('Проверьте строки меню или повторите сохранение.'))
  }}>
    {rows.map((row, index) => <fieldset className="form-grid" key={index}>
      <legend>Позиция {index + 1}</legend>
      <label>Продукт<input value={row.name} required onChange={(event) => change(index, { name: event.target.value })} /></label>
      <label>Категория<select value={row.category} onChange={(event) => change(index, { category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>Масса, г<input type="number" step="any" min="0.1" value={row.grams ?? ''} onChange={(event) => change(index, { grams: event.target.value ? Number(event.target.value) : undefined })} /></label>
      <label>Количество, шт.<input type="number" min="1" value={row.units ?? ''} onChange={(event) => change(index, { units: event.target.value ? Number(event.target.value) : undefined })} /></label>
      <button className="secondary" type="button" onClick={() => setRows(rows.filter((_, i) => i !== index))}>Убрать позицию</button>
    </fieldset>)}
    <button className="secondary" type="button" onClick={() => setRows([...rows, { name: '', category: 'Прочее' }])}>Добавить позицию меню</button>
    <button className="action">Сохранить меню дня</button>
    <p role="status">{error}</p>
  </form>
}

function RecipeEditor({ products }: { products: Product[] }) {
  const [ingredients, setIngredients] = useState(1)
  const [message, setMessage] = useState('')
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), [], [])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const result = recipeSchema.safeParse({
      id: crypto.randomUUID(), name: fields.get('name'), servings: Number(fields.get('servings')), yieldGrams: Number(fields.get('yield')),
      ingredients: fields.getAll('ingredient').map((id, index) => ({ product: products.find((row) => row.id === id), grams: Number(fields.getAll('grams')[index]) })),
    })
    if (!result.success) { setMessage('Проверьте ингредиенты, выход и число порций.'); return }
    try { await db.recipes.add(result.data); form.reset(); setIngredients(1); setMessage('Рецепт сохранён.') }
    catch { setMessage('Не удалось сохранить рецепт.') }
  }
  return <section className="panel section-gap">
    <form className="form-grid" onSubmit={save}>
      <h2>Создать рецепт</h2>
      <label>Название рецепта<input name="name" required /></label>
      <label>Вес готового блюда, г<input name="yield" required min="1" step="any" type="number" /></label>
      <label>Число порций<input name="servings" required min="1" type="number" defaultValue="1" /></label>
      {Array.from({ length: ingredients }, (_, i) => <div key={i} className="form-grid">
        <label>Ингредиент<select name="ingredient" required defaultValue=""><option value="">Выберите продукт</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label>Масса ингредиента, г<input name="grams" required min="0.1" step="any" type="number" /></label>
      </div>)}
      <button className="secondary" type="button" onClick={() => setIngredients(ingredients + 1)}>Добавить ингредиент</button>
      {ingredients > 1 && <button className="secondary" type="button" onClick={() => setIngredients(ingredients - 1)}>Убрать последний ингредиент</button>}
      <button className="action">Сохранить рецепт</button>
      <p role="status">{message}</p>
    </form>
    <ul className="record-list">{recipes.map((recipe) => <li key={recipe.id}>{recipe.name} · {nutritionNumber.format(recipeNutrients(recipe).calories / recipe.servings)} ккал на порцию</li>)}</ul>
  </section>
}
