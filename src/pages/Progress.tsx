import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db, defaultProfile } from '../db/database'
import { useProgramProgress } from '../db/useProgramProgress'
import { energyBalanceDays, kcalPerKgEquivalent } from '../domain/energyBalance'
import { addDays, dateLabel, localDate } from '../domain/dates'
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
  const today = localDate()
  const { days = [], profile = defaultProfile } = useProgramProgress(today) ?? {}
  const length = profile.programDays
  const confirmations = useLiveQuery(() => db.intakeConfirmations.toArray(), [], [])
  const energy = energyBalanceDays({ profile, weights, meals, walks, workouts, confirmations, today })
  const confirmed = energy.filter((row) => row.confirmed)
  const total = confirmed.reduce((sum, row) => sum + (row.deficit ?? 0), 0)
  const treadmillTotal = energy.reduce((sum, row) => sum + row.treadmill, 0)
  const missing = energy.reduce((sum, row) => sum + row.missing, 0)
  const latest = [...weights].reverse().find(({ date }) => date <= today)
  const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 })
  const signed = new Intl.NumberFormat('ru', { maximumFractionDigits: 2, signDisplay: 'exceptZero' })
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
    <section className="panel section-gap">
      <h2>Энергобаланс и вес</h2>
      <p>{latest ? `Изменение по весам от старта · ${signed.format(latest.kg - profile.startingWeightKg)} кг` : 'Добавьте взвешивание, чтобы увидеть фактическое изменение.'}</p>
      {treadmillTotal > 0 && <p className="mt-3">Дорожка за всё время · ≈ {number.format(Math.round(treadmillTotal))} ккал</p>}
      {confirmed.length ? <>
        <p className="mt-3">{total >= 0 ? 'Суммарный дефицит' : 'Суммарный профицит'} · ≈ {number.format(Math.round(Math.abs(total)))} ккал</p>
        <p>Условный эквивалент · {signed.format(-total / kcalPerKgEquivalent)} кг</p>
        <p className="muted">В сумме учтено дней с полным дневником: {confirmed.length}. Эквивалент показывает энергию баланса, а вес меняется также из-за воды и других факторов.</p>
      </> : <p className="muted mt-3">Для суммарного дефицита подтвердите полную запись еды за день в разделе питания.</p>}
      {energy.length > 0 && <>
        {missing > 0 && <p className="muted">Силовые без длительности: {missing}. Укажите длительность в истории.</p>}
        <details className="section-gap" open><summary>Расчёт по дням</summary>
          <ul className="record-list">{energy.map((row) => <li key={row.date}><div>
            <strong>{dateLabel(row.date)}</strong>
            <p>Базовый расход ≈ {row.baseline} ккал · тренировки ≈ {Math.round(row.training)} ккал{row.treadmill > 0 && ` (дорожка ≈ ${Math.round(row.treadmill)} ккал)`}</p>
            {row.calories !== null && <p>Еда ≈ {Math.round(row.calories)} ккал</p>}
            {row.deficit === null
              ? <p className="muted">Добавьте еду за день для оценки баланса.</p>
              : <p>{row.confirmed ? '' : 'Предварительно · '}{row.deficit >= 0 ? 'дефицит' : 'профицит'} ≈ {Math.round(Math.abs(row.deficit))} ккал</p>}
          </div></li>)}</ul>
        </details>
        <p className="muted mt-3">Базовый расход оценён для малоподвижного дня. Расход дорожки учитывает скорость, время, наклон и вес.</p>
      </>}
      <Link to="/nutrition" className="secondary inline-block section-gap">Открыть питание</Link>
    </section>
    <Chart title="Вес и недельная тенденция" rows={weightRows} series={['Вес, кг', 'Среднее за 7 дней, кг']} />
    <Chart title="Калории" rows={nutritionRows} series={[nutrientLabels.calories]} />
    <Chart title="Белки, жиры и углеводы" rows={nutritionRows} series={nutrientKeys.slice(1).map((key) => nutrientLabels[key])} />
    <Chart title="Ходьба" rows={walkRows} series={['Минуты']} />
    <Chart title="Силовые тренировки" rows={workoutRows} series={['Тренировки']} />
  </>
}
