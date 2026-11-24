import { Activity, CalendarDays, Dumbbell, Footprints, Scale, Utensils } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, defaultProfile } from '../db/database'
import { menuForDate } from '../data/meals'
import { calculateBmi } from '../domain/calculations'
import { localDate } from '../domain/dates'
import { mealKinds, nutrientKeys, nutrientLabels, nutritionNumber, scaleNutrients, sumNutrients } from '../domain/nutrition'
import { activeDayNumber, isClosed, planForDay, taskKeys, taskNames } from '../domain/program'

const formatDate = new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' })

export function Dashboard() {
  const now = new Date()
  const today = localDate(now)
  const profile = useLiveQuery(() => db.profiles.get('profile')) ?? defaultProfile
  const latest = useLiveQuery(() => db.weights.where('date').belowOrEqual(today).last(), [today])
  const program = useLiveQuery(() => db.programs.get('program'))
  const days = useLiveQuery(() => db.days.toArray(), [], [])
  const meals = useLiveQuery(() => db.meals.where('date').equals(today).toArray(), [today], [])
  const currentWeight = latest?.kg ?? profile.startingWeightKg
  const bmi = calculateBmi(currentWeight, profile.heightCm)
  const active = activeDayNumber(days, profile.programDays)
  const day = days.find(({ number }) => number === active)
  const plan = program && active ? planForDay(active) : undefined
  const closed = days.filter((entry) => entry.number <= profile.programDays && isClosed(entry)).length
  const totals = sumNutrients(meals.map((entry) => scaleNutrients(entry.per100g, entry.grams / 100)))
  const menu = useLiveQuery(() => db.menuOverrides.get(today), [today])?.meals ?? menuForDate(today)

  return <>
    <header className="page-heading">
      <p className="eyebrow"><CalendarDays size={17} aria-hidden="true" /> {formatDate.format(now)}</p>
      <h1>Привет!</h1>
    </header>
    <section className="hero" aria-labelledby="program-heading">
      <div className="hero-icon"><Activity size={27} aria-hidden="true" /></div>
      <div className="flex-1">
        <p className="hero-label">ПРОГРАММА</p>
        <h2 id="program-heading">{program ? active ? `День ${active} из ${profile.programDays}` : 'Программа завершена' : `План на ${profile.programDays} день`}</h2>
        {program && <><p>Закрыто дней · {closed} из {profile.programDays}</p><progress className="w-full accent-emerald-300" aria-label="Закрытые дни" max={profile.programDays} value={closed} /></>}
        <Link className="secondary inline-block mt-3" to="/calendar">{program ? 'Открыть календарь' : 'Начать день'}</Link>
      </div>
    </section>
    <div className="dashboard-grid">
      <section className="panel" aria-labelledby="weight-heading">
        <h2 id="weight-heading"><Scale aria-hidden="true" /> Вес</h2>
        <p className="metric">{nutritionNumber.format(currentWeight)} <small>кг</small></p>
        <p className="muted">{latest ? 'Последнее измерение' : 'Стартовый вес'} · ИМТ {nutritionNumber.format(bmi)}</p>
        <p className="note">{latest ? 'От старта · ' + nutritionNumber.format(currentWeight - profile.startingWeightKg) + ' кг' : 'Измерений пока нет'}</p>
        <Link className="secondary inline-block section-gap" to="/weight">Открыть дневник</Link>
      </section>
      <section className="panel" aria-labelledby="nutrition-heading">
        <h2 id="nutrition-heading"><Utensils aria-hidden="true" /> Питание</h2>
        {nutrientKeys.map((key) => <div key={key} className="mb-2">
          <p>{nutrientLabels[key]} · {nutritionNumber.format(totals[key])} / {profile.goals[key]}</p>
          <progress className="w-full accent-emerald-700" aria-label={nutrientLabels[key]} max={profile.goals[key]} value={Math.min(totals[key], profile.goals[key])} />
        </div>)}
        <Link className="secondary inline-block section-gap" to="/nutrition">Записать еду</Link>
      </section>
      <section className="panel" aria-labelledby="menu-heading">
        <h2 id="menu-heading"><Utensils aria-hidden="true" /> Меню на сегодня</h2>
        {menu.map((items, index) => <p className="mb-2" key={index}><strong>{mealKinds[index]}</strong> · {items.map(({ name }) => name.toLocaleLowerCase('ru')).join(', ')}</p>)}
        <Link className="secondary inline-block section-gap" to="/nutrition">Посмотреть порции</Link>
      </section>
      <section className="panel" aria-labelledby="activity-heading">
        <h2 id="activity-heading"><Dumbbell aria-hidden="true" /> План активности</h2>
        {plan ? <>
          <p>{plan.kind ? 'Силовая ' + plan.kind : plan.minutes ? 'Силовых сегодня нет' : 'День отдыха'}</p>
          {plan.minutes && <p className="activity-row"><Footprints size={20} aria-hidden="true" /> {day?.minutes ?? plan.minutes} мин · {day?.speed ?? plan.speed} км/ч · {day?.incline ?? plan.incline}%</p>}
          <ul className="my-3">{taskKeys.filter((key) => key === 'nutrition' || key === 'weight' || (key === 'walking' && Boolean(plan.minutes)) || (key === 'workout' && Boolean(plan.kind))).map((key) => <li key={key}>{day?.tasks[key] ? '✓' : '○'} {taskNames[key]}</li>)}</ul>
        </> : <p className="muted">{program ? 'Все дни программы закрыты.' : 'План появится после старта программы.'}</p>}
        <div className="inline-actions section-gap"><Link className="secondary" to="/workouts">Тренировки</Link><Link className="secondary" to="/treadmill">Дорожка</Link></div>
      </section>
    </div>
  </>
}
