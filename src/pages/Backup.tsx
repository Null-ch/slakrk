import { useState, type FormEvent } from 'react'
import { csv, download, exportBackup, importBackup, readBackup } from '../domain/backup'
import { localDate } from '../domain/dates'

export function Backup() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const file = new FormData(form).get('backup')
    if (!(file instanceof File) || !file.size) { setMessage('Выберите файл JSON.'); return }
    setBusy(true)
    try {
      const data = readBackup(await file.text())
      if (!window.confirm(`Заменить текущие данные? В копии: измерения — ${data.weights.length}, еда — ${data.meals.length}, тренировки — ${data.workouts.length}.`)) return
      await importBackup(data)
      form.reset()
      setMessage('Данные восстановлены.')
    } catch { setMessage('Импорт не выполнен. Проверьте формат, версию и содержимое файла.') }
    finally { setBusy(false) }
  }

  async function save(kind: 'json' | 'weight' | 'nutrition' | 'workouts') {
    try {
      const data = await exportBackup()
      if (kind === 'json') {
        download(`stop-jir-${localDate()}.json`, JSON.stringify(data, null, 2), 'application/json')
        return
      }
      const rows = {
        weight: [['Дата', 'Вес, кг', 'Талия, см'], ...data.weights.map((row) => [row.date, row.kg, row.waistCm])],
        nutrition: [['Дата', 'Приём пищи', 'Продукт', 'Масса, г', 'Калории', 'Белки', 'Жиры', 'Углеводы'], ...data.meals.map((row) => [row.date, row.meal, row.name, row.grams, row.per100g.calories * row.grams / 100, row.per100g.protein * row.grams / 100, row.per100g.fat * row.grams / 100, row.per100g.carbohydrates * row.grams / 100])],
        workouts: [['Дата', 'Тип', 'Статус', 'Упражнение или комментарий', 'Подходы', 'Минуты', 'Скорость', 'Наклон', 'Расстояние'],
          ...data.workouts.flatMap((row) => row.exercises.map((item) => [row.date, row.kind, row.finished ? 'Завершена' : 'В процессе', item.name, item.reps.map((reps) => reps ?? '').join('/') ])),
          ...data.walks.map((row) => [row.date, 'Ходьба', row.effort, row.comment, '', row.minutes, row.speed, row.incline, row.distance]),
        ],
      }
      download(`${kind}-${localDate()}.csv`, csv(rows[kind]), 'text/csv;charset=utf-8')
    } catch { setMessage('Не удалось сформировать файл.') }
  }

  return <>
    <header className="page-heading"><h1>Резервные копии</h1><p className="muted">Сохрани JSON, чтобы перенести записи на другое устройство.</p></header>
    <section className="panel form-grid"><h2>Экспорт</h2>
      <button className="action" onClick={() => void save('json')}>Скачать все данные · JSON</button>
      <button className="secondary" onClick={() => void save('weight')}>Вес · CSV</button>
      <button className="secondary" onClick={() => void save('nutrition')}>Питание · CSV</button>
      <button className="secondary" onClick={() => void save('workouts')}>Тренировки · CSV</button>
    </section>
    <form className="panel form-grid section-gap" onSubmit={restore}><h2>Импорт</h2>
      <label>Резервная копия<input name="backup" type="file" accept=".json,application/json" required /></label>
      <button className="action" disabled={busy}>Проверить и восстановить</button>
    </form>
    <p className="section-gap" role="status">{message}</p>
  </>
}
