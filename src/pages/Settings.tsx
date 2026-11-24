import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { db, profileSchema, type Profile } from '../db/database'

export function Settings() {
  const profile = useLiveQuery(() => db.profiles.get('profile'))
  return <><header className="page-heading"><h1>Настройки</h1></header>{profile && <ProfileForm profile={profile} />}</>
}

function ProfileForm({ profile }: { profile: Profile }) {
  const [message, setMessage] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const value = (key: string) => String(data.get(key) ?? '')
    const result = profileSchema.safeParse({
      id: profile.id, sex: value('sex'), ageYears: Number(value('ageYears')),
      heightCm: Number(value('heightCm')), startingWeightKg: Number(value('startingWeightKg')),
      activity: value('activity'), averageStepsUpTo: Number(value('averageStepsUpTo')),
      experience: value('experience'), medicalRestrictions: value('medicalRestrictions').trim() || null,
      programDays: Number(value('programDays')), theme: value('theme'),
      goals: { calories: Number(value('calories')), protein: Number(value('protein')), fat: Number(value('fat')), carbohydrates: Number(value('carbohydrates')) },
    })
    if (!result.success) { setMessage('Проверьте значения полей.'); return }
    try { await db.profiles.put(result.data); setMessage('Настройки сохранены.') }
    catch { setMessage('Не удалось сохранить настройки.') }
  }

  return <form className="panel form-grid" onSubmit={save}>
    <h2>Профиль</h2>
    <label>Пол<select name="sex" defaultValue={profile.sex}><option>Мужской</option><option>Женский</option></select></label>
    <NumberField name="ageYears" label="Возраст, лет" value={profile.ageYears} min={18} max={120} />
    <NumberField name="heightCm" label="Рост, см" value={profile.heightCm} min={1} max={300} step="any" />
    <NumberField name="startingWeightKg" label="Стартовый вес, кг" value={profile.startingWeightKg} min={1} max={1000} step="any" />
    <label>Активность<input name="activity" required defaultValue={profile.activity} /></label>
    <NumberField name="averageStepsUpTo" label="Среднее количество шагов, до" value={profile.averageStepsUpTo} min={0} />
    <label>Спортивный опыт<input name="experience" required defaultValue={profile.experience} /></label>
    <label>Медицинские ограничения<textarea name="medicalRestrictions" defaultValue={profile.medicalRestrictions ?? ''} /></label>
    <NumberField name="programDays" label="Продолжительность, дней" value={profile.programDays} min={1} max={365} />
    <h2>Дневные цели</h2>
    <NumberField name="calories" label="Калории, ккал" value={profile.goals.calories} min={1} step="any" />
    <NumberField name="protein" label="Белки, г" value={profile.goals.protein} min={1} step="any" />
    <NumberField name="fat" label="Жиры, г" value={profile.goals.fat} min={1} step="any" />
    <NumberField name="carbohydrates" label="Углеводы, г" value={profile.goals.carbohydrates} min={1} step="any" />
    <label>Тема<select name="theme" defaultValue={profile.theme}><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label>
    <button className="action" type="submit">Сохранить</button>
    <p role="status">{message}</p>
  </form>
}

function NumberField({ name, label, value, min, max, step = '1' }: {
  name: string; label: string; value: number; min: number; max?: number; step?: string
}) {
  return <label>{label}<input type="number" name={name} defaultValue={value} min={min} max={max} step={step} required /></label>
}
