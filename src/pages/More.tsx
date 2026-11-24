import { initialProfile } from '../data/profile'

const rows = [
  ['Пол', initialProfile.sex],
  ['Возраст', `${initialProfile.ageYears} лет`],
  ['Рост', `${initialProfile.heightCm} см`],
  ['Активность', initialProfile.activity],
  ['Шаги', `До ${new Intl.NumberFormat('ru').format(initialProfile.averageStepsUpTo)}`],
  ['Спортивный опыт', initialProfile.experience],
  ['Медицинские ограничения', initialProfile.medicalRestrictions ?? 'Не указаны'],
]

export function More() {
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
        <p className="note">Редактирование профиля появится на втором этапе.</p>
      </section>
    </>
  )
}
