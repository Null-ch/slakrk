import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, defaultProfile } from '../db/database'

export function More() {
const initialProfile = useLiveQuery(() => db.profiles.get('profile')) ?? defaultProfile

const rows = [
  ['Пол', initialProfile.sex],
  ['Возраст', `${initialProfile.ageYears} лет`],
  ['Рост', `${initialProfile.heightCm} см`],
  ['Активность', initialProfile.activity],
  ['Шаги', `До ${new Intl.NumberFormat('ru').format(initialProfile.averageStepsUpTo)}`],
  ['Спортивный опыт', initialProfile.experience],
  ['Медицинские ограничения', initialProfile.medicalRestrictions ?? 'Не указаны'],
]

  return (
    <>
      <header className="page-heading"><h1>Ещё</h1></header>
      <section className="panel" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Стартовый профиль</h2>
        <dl className="profile-list">
          {rows.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
                <div className="section-links section-gap">
          <Link className="secondary" to="/settings">Настройки профиля</Link>
          <Link className="secondary" to="/weight">Дневник веса</Link>
          <Link className="secondary" to="/calendar">Календарь</Link>
          <Link className="secondary" to="/shopping">Покупки</Link>
          <Link className="secondary" to="/reminders">Напоминания</Link>
          <Link className="secondary" to="/backup">Резервные копии</Link>
        </div>
      </section>
    </>
  )
}
