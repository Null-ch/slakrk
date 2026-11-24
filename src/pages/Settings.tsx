import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { db, profileSchema, type Profile } from '../db/database'
import { localDate } from '../domain/dates'
import { activityLevels, activityOptions, recommendPlan } from '../domain/personalPlan'

export function Settings() {
  const profile = useLiveQuery(() => db.profiles.get('profile'))
  return <><header className="page-heading"><h1>Настройки</h1></header>{profile && <ProfileForm profile={profile} />}</>
}

function ProfileForm({ profile }: { profile: Profile }) {
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<Profile | null>(profile)
  const recommendation = draft ? recommendPlan(draft, localDate()) : undefined
  const [saving, setSaving] = useState(false)

  function read(form: HTMLFormElement) {
    const data = new FormData(form)
    const value = (key: string) => String(data.get(key) ?? '')
    return profileSchema.safeParse({
      ...profile, id: profile.id, sex: value('sex'), ageYears: Number(value('ageYears')),
      heightCm: Number(value('heightCm')), startingWeightKg: Number(value('startingWeightKg')),
      activity: value('activity'), averageStepsUpTo: Number(value('averageStepsUpTo')),
      recommendationActivity: value('recommendationActivity'),
      experience: value('experience'), medicalRestrictions: value('medicalRestrictions').trim() || null,
      programDays: Number(value('programDays')), theme: value('theme'),
      goals: { calories: Number(value('calories')), protein: Number(value('protein')), fat: Number(value('fat')), carbohydrates: Number(value('carbohydrates')) },
    })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const result = read(form)
    if (!result.success) { setMessage('Проверьте значения полей.'); return }
    const profile = result.data
    const next = recommendPlan(profile, localDate())
    const apply = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'recommendation'
    if (apply && !next) { setMessage('Автоматический план недоступен для этих параметров.'); return }
    if (apply && !new FormData(form).has('canApply')) {
      setMessage('Подтвердите, что вам подходит обычная физическая нагрузка.')
      return
    }
    const updated: Profile = { ...profile, estimatedMaintenance: next?.maintenance,
      ...(apply && next ? { autoPlan: true, appliedActivity: next.level, goals: next.goals } : {}),
    }
    setSaving(true)
    try {
      await db.profiles.put(updated)
      setDraft(updated)
      if (apply) {
        for (const [key, value] of Object.entries(updated.goals)) {
          const input = form.elements.namedItem(key)
          if (input instanceof HTMLInputElement) input.value = String(value)
        }
      }
      setMessage(apply ? 'Рекомендации применены.' : 'Настройки сохранены.')
    } catch { setMessage('Не удалось сохранить настройки.') }
    finally { setSaving(false) }
  }

  return <form className="panel form-grid" onSubmit={save} onChange={(event) => {
    const result = read(event.currentTarget)
    setDraft(result.success ? result.data : null)
    setMessage('')
  }}>
    <h2>Профиль</h2>
    <label>Пол<select name="sex" defaultValue={profile.sex}><option>Мужской</option><option>Женский</option></select></label>
    <NumberField name="ageYears" label="Возраст, лет" value={profile.ageYears} min={18} max={120} />
    <NumberField name="heightCm" label="Рост, см" value={profile.heightCm} min={1} max={300} step="any" />
    <NumberField name="startingWeightKg" label="Стартовый вес, кг" value={profile.startingWeightKg} min={1} max={1000} step="any" />
    <label>Текущая активность для расчёта<select name="recommendationActivity" defaultValue={profile.recommendationActivity ?? 'starter'}>
      {activityLevels.map((key) => <option key={key} value={key}>{activityOptions[key].label}</option>)}
    </select></label>
    <label>Описание активности<input name="activity" required defaultValue={profile.activity} /></label>
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
    <button className="action" type="submit" disabled={saving}>Сохранить настройки</button>
    <section className="form-grid section-gap" aria-live="polite">
      <h2>Рекомендуемый план</h2>
      {recommendation ? <>
        <p>Расход ≈ {recommendation.maintenance} ккал · цель {recommendation.calories} ккал · {recommendation.reduction ? `дефицит ≈ ${recommendation.reduction} ккал` : 'без дефицита'}.</p>
        <p>Сегодня в меню ≈ {recommendation.menuCalories} ккал · белки {recommendation.goals.protein} г · жиры {recommendation.goals.fat} г · углеводы {recommendation.goals.carbohydrates} г.</p>
        <p>На дни с ходьбой · {activityOptions[recommendation.level].walk} минут в комфортном темпе. На силовых · {activityOptions[recommendation.level].sets} {activityOptions[recommendation.level].sets === 1 ? 'подход' : 'подхода'} на упражнение.</p>
        <label className="!flex items-center"><input className="!w-5" type="checkbox" name="canApply" /> Мне подходит обычная физическая нагрузка, у меня нет медицинских ограничений, беременности или грудного вскармливания.</label>
        <button className="secondary" type="submit" value="recommendation" disabled={saving}>Применить рекомендации</button>
      </> : <p className="muted">Расчёт доступен для взрослых с корректно заполненным профилем, без указанных медицинских ограничений и без недостаточного веса.</p>}
    </section>
    <p role="status">{message}</p>
  </form>
}

function NumberField({ name, label, value, min, max, step = '1' }: {
  name: string; label: string; value: number; min: number; max?: number; step?: string
}) {
  return <label>{label}<input type="number" name={name} defaultValue={value} min={min} max={max} step={step} required /></label>
}
