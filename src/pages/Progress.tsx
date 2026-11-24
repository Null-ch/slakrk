import { useLiveQuery } from 'dexie-react-hooks'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db, defaultProfile } from '../db/database'
import { addDays } from '../domain/dates'
import { nutrientKeys, nutrientLabels, scaleNutrients, sumNutrients } from '../domain/nutrition'

type Point = { date: string; [key: string]: string | number }

export function Chart({ title, rows, series }: { title: string; rows: Point[]; series: string[] }) {
  const colors = ['#27865c', '#2974ab', '#b26425', '#8951a1']
  return <section className="panel section-gap">
    <h2>{title}</h2>
    {rows.length === 0 ? <p className="muted">Добавь записи, чтобы увидеть график.</p> :
      <ResponsiveContainer width="100%" height={220} minWidth={0}>
        <LineChart data={rows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(date: string) => date.slice(5)} /><YAxis width={44} domain={['auto', 'auto']} /><Tooltip />
          {series.map((key, index) => <Line key={key} type="linear" dataKey={key} stroke={colors[index % colors.length]} strokeWidth={2} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>}
  </section>
}

export function Progress() {
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), [], [])
  const meals = useLiveQuery(() => db.meals.orderBy('date').toArray(), [], [])
  const walks = useLiveQuery(() => db.walks.orderBy('date').toArray(), [], [])
  const workouts = useLiveQuery(() => db.workouts.orderBy('date').toArray(), [], [])
  const days = useLiveQuery(() => db.days.orderBy('number').toArray(), [], [])
  const length = useLiveQuery(() => db.profiles.get('profile'))?.programDays ?? defaultProfile.programDays
  const weightRows = weights.map(({ date, kg }) => {
    const window = weights.filter((row) => row.date >= addDays(date, -6) && row.date <= date)
    return { date, 'Вес, кг': kg, 'Среднее за 7 дней, кг': Number((window.reduce((sum, row) => sum + row.kg, 0) / window.length).toFixed(2)) }
  })
  const nutritionRows = [...new Set(meals.map(({ date }) => date))].map((date) => {
    const totals = sumNutrients(meals.filter((row) => row.date === date).map((row) => scaleNutrients(row.per100g, row.grams / 100)))
    return { date, ...Object.fromEntries(nutrientKeys.map((key) => [nutrientLabels[key], Number(totals[key].toFixed(1))])) }
  })
  const walkRows = [...new Set(walks.map(({ date }) => date))].map((date) => ({ date, 'Минуты': walks.filter((row) => row.date === date).reduce((sum, row) => sum + row.minutes, 0) }))
  const finished = workouts.filter(({ finished }) => finished)
  const workoutRows = [...new Set(finished.map(({ date }) => date))].map((date) => ({ date, 'Тренировки': finished.filter((row) => row.date === date).length }))
  const complete = days.filter((day) => day.number <= length && day.status === 'Выполнен').length

  return <>
    <header className="page-heading"><h1>Прогресс</h1></header>
    <section className="panel"><h2>Выполнение плана</h2><p>{complete} из {length} дней · {Math.round(100 * complete / length)}%</p><progress className="w-full accent-emerald-700" aria-label="Выполнение плана" max={length} value={complete} /></section>
    <Chart title="Вес и недельная тенденция" rows={weightRows} series={['Вес, кг', 'Среднее за 7 дней, кг']} />
    <Chart title="Калории" rows={nutritionRows} series={[nutrientLabels.calories]} />
    <Chart title="Белки, жиры и углеводы" rows={nutritionRows} series={nutrientKeys.slice(1).map((key) => nutrientLabels[key])} />
    <Chart title="Ходьба" rows={walkRows} series={['Минуты']} />
    <Chart title="Силовые тренировки" rows={workoutRows} series={['Тренировки']} />
  </>
}
