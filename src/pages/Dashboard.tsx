import { Activity, CalendarDays, Dumbbell, Footprints, Scale, Utensils } from 'lucide-react'
import { initialNutritionGoals, initialProfile } from '../data/profile'
import { calculateBmi } from '../domain/calculations'

const formatNumber = new Intl.NumberFormat('ru', { maximumFractionDigits: 1 })
const formatDate = new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' })
const goals = initialNutritionGoals

const macros = [
  { label: 'Белки', grams: goals.protein },
  { label: 'Жиры', grams: goals.fat },
  { label: 'Углеводы', grams: goals.carbohydrates },
]

export function Dashboard() {
  const bmi = calculateBmi(initialProfile.startingWeightKg, initialProfile.heightCm)

  return (
    <>
      <header className="page-heading">
        <p className="eyebrow"><CalendarDays size={17} /> {formatDate.format(new Date())}</p>
        <h1>Привет!</h1>
        <p className="muted">Здесь будет твой дневник питания, движения и веса.</p>
      </header>
      <section className="hero" aria-labelledby="program-heading">
        <div className="hero-icon"><Activity size={27} aria-hidden="true" /></div>
        <div>
          <p className="hero-label">ПРОГРАММА</p>
          <h2 id="program-heading">{initialProfile.programDays} день</h2>
          <p>Старт и календарь появятся после подключения программы.</p>
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="panel" aria-labelledby="weight-heading">
          <h2 id="weight-heading"><Scale /> Вес</h2>
          <p className="metric">{formatNumber.format(initialProfile.startingWeightKg)} <small>кг</small></p>
          <p className="muted">Стартовый вес · ИМТ {formatNumber.format(bmi)}</p>
          <p className="note">Измерений пока нет</p>
        </section>
        <section className="panel" aria-labelledby="nutrition-heading">
          <h2 id="nutrition-heading"><Utensils /> Питание</h2>
          <p className="metric">{formatNumber.format(goals.calories)} <small>ккал</small></p>
          <p className="muted">Дневная цель</p>
          <ul className="macro-list">
            {macros.map(({ label, grams }) => (
              <li key={label}><strong>{grams} г</strong><span>{label}</span></li>
            ))}
          </ul>
        </section>
        <section className="panel" aria-labelledby="activity-heading">
          <h2 id="activity-heading"><Dumbbell /> Активность</h2>
          <p className="activity-row"><Footprints size={20} aria-hidden="true" /> Ходьба</p>
          <p className="muted">Дневники ходьбы и силовых тренировок появятся на четвёртом этапе.</p>
        </section>
      </div>
    </>
  )
}
