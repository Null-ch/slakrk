import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { db, profileSchema, type Profile } from '../db/database'
import { trainingLoad } from '../domain/program'
import { localDate } from '../domain/dates'
import { menuStyles, menuStyleLabels } from '../domain/menuRotation'
import { activityLevels, activityOptions, recommendPlan } from '../domain/personalPlan'

type Feedback = { kind: 'dirty' | 'success' | 'error'; message: string }

export function Settings() {
  const profile = useLiveQuery(() => db.profiles.get('profile'))
  return <><header className="page-heading"><h1>Настройки</h1></header>{profile && <ProfileForm profile={profile} />}</>
}

function ProfileForm({ profile }: { profile: Profile }) {
  const [feedback, setFeedback] = useState<Feedback>()
  const [toast, setToast] = useState<Feedback>()
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(undefined), 4000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function report(next: Feedback) {
    setFeedback(next)
    setToast(next.kind === 'dirty' ? undefined : next)
  }
  const [draft, setDraft] = useState<Profile | null>(profile)
  const [saving, setSaving] = useState(false)
  const load = draft ? trainingLoad(draft, 1) : undefined
  const recommendation = draft ? recommendPlan(draft, localDate()) : undefined

  function read(data: FormData, preview = false) {
    const value = (key: string) => String(data.get(key) ?? '')
    const goal = (key: keyof Profile['goals']) => !preview && data.has(key) ? Number(value(key)) : profile.goals[key]
    return profileSchema.safeParse({
      ...profile, sex: value('sex'), ageYears: Number(value('ageYears')),
      heightCm: Number(value('heightCm')), startingWeightKg: Number(value('startingWeightKg')),
      activity: value('activity'), averageStepsUpTo: Number(value('averageStepsUpTo')),
      recommendationActivity: value('recommendationActivity'), menuPreference: value('menuPreference'),
      experience: value('experience'), medicalRestrictions: value('medicalRestrictions').trim() || null,
      programDays: Number(value('programDays')), theme: value('theme'),
      goals: { calories: goal('calories'), protein: goal('protein'), fat: goal('fat'), carbohydrates: goal('carbohydrates') },
    })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const data = new FormData(event.currentTarget)
    const result = read(data)
    if (!result.success) { report({ kind: 'error', message: 'Проверьте значения в полях профиля.' }); return }
    const next = recommendPlan(result.data, localDate())
    const apply = next && (profile.autoPlan || data.has('canApply'))
    const updated: Profile = {
      ...result.data,
      appliedMenu: result.data.menuPreference ?? 'mixed',
      estimatedMaintenance: next?.maintenance,
      ...(apply ? { autoPlan: true, appliedActivity: next.level, goals: next.goals } : {}),
    }
    setToast(undefined)
    setSaving(true)
    try {
      await db.profiles.put(updated)
      setDraft(updated)
      report({ kind: 'success', message: apply
        ? 'Настройки сохранены. Меню и рекомендации обновлены.'
        : next
          ? 'Профиль и меню сохранены. Для применения рекомендаций отметьте согласие выше.'
          : 'Профиль и меню сохранены. Для этих параметров автоматический расчёт недоступен.' })
    } catch {
      report({ kind: 'error', message: 'Не удалось сохранить настройки. Попробуйте ещё раз.' })
    } finally { setSaving(false) }
  }

  return <form className="panel form-grid" onSubmit={save} onChange={(event) => {
    const result = read(new FormData(event.currentTarget), true)
    setDraft(result.success ? result.data : null)
    report({ kind: 'dirty', message: 'Есть несохранённые изменения.' })
  }} onInvalid={() => report({ kind: 'error', message: 'Проверьте поля, выделенные браузером.' })}>
    {toast && <div className="settings-toast" data-kind={toast.kind} aria-hidden="true">
      {toast.kind === 'error' ? <CircleAlert size={20} /> : <CheckCircle2 size={20} />}
      <span>{toast.message}</span>
    </div>}
    <fieldset className="form-grid" disabled={saving}>
      <legend className="text-xl font-semibold mb-3">Профиль</legend>
      <label>Пол<select name="sex" defaultValue={profile.sex}><option>Мужской</option><option>Женский</option></select></label>
      <NumberField name="ageYears" label="Возраст, лет" value={profile.ageYears} min={18} max={120} />
      <NumberField name="heightCm" label="Рост, см" value={profile.heightCm} min={1} max={300} step="any" />
      <NumberField name="startingWeightKg" label="Стартовый вес, кг" value={profile.startingWeightKg} min={1} max={1000} step="any" />
      <label>Текущая активность для расчёта<select name="recommendationActivity" defaultValue={profile.recommendationActivity ?? 'starter'}>
        {activityLevels.map((key) => <option key={key} value={key}>{activityOptions[key].label}</option>)}
      </select></label>
      <label>Предпочтения меню<select name="menuPreference" defaultValue={profile.menuPreference ?? profile.appliedMenu ?? 'mixed'}>
        {menuStyles.map((key) => <option key={key} value={key}>{menuStyleLabels[key]}</option>)}
      </select></label>
      <label>Описание активности<input name="activity" required defaultValue={profile.activity} /></label>
      <NumberField name="averageStepsUpTo" label="Среднее количество шагов, до" value={profile.averageStepsUpTo} min={0} />
      <label>Спортивный опыт<input name="experience" required defaultValue={profile.experience} /></label>
      <label>Медицинские ограничения<textarea name="medicalRestrictions" defaultValue={profile.medicalRestrictions ?? ''} /></label>
      <NumberField name="programDays" label="Продолжительность, дней" value={profile.programDays} min={1} max={365} />
      <label>Тема<select name="theme" defaultValue={profile.theme}><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label>
      <section className="form-grid section-gap" aria-labelledby="recommendation-title">
        <h2 id="recommendation-title">Рекомендуемый план</h2>
        {recommendation ? <>
          <p>Расход ≈ {recommendation.maintenance} ккал · цель {recommendation.calories} ккал · {recommendation.reduction ? `дефицит ≈ ${recommendation.reduction} ккал` : 'без дефицита'}.</p>
          <p>Сегодня в меню ≈ {recommendation.menuCalories} ккал · белки {recommendation.goals.protein} г · жиры {recommendation.goals.fat} г · углеводы {recommendation.goals.carbohydrates} г.</p>
          <p>Ходьба · {load?.minutes} минут в комфортном темпе. Силовые · {load?.sets} {load?.sets === 1 ? 'подход' : 'подхода'} на упражнение.</p>
          {!profile.autoPlan && <label className="!flex items-center"><input className="!w-5" type="checkbox" name="canApply" /> Мне подходит обычная физическая нагрузка, у меня нет медицинских ограничений, беременности или грудного вскармливания.</label>}
        </> : <>
          <p className="muted">Расчёт доступен для взрослых с корректно заполненным профилем, без указанных медицинских ограничений и без недостаточного веса.</p>
          {draft && <>
            <h2>Дневные цели</h2>
            <NumberField name="calories" label="Калории, ккал" value={profile.goals.calories} min={1} step="any" />
            <NumberField name="protein" label="Белки, г" value={profile.goals.protein} min={1} step="any" />
            <NumberField name="fat" label="Жиры, г" value={profile.goals.fat} min={1} step="any" />
            <NumberField name="carbohydrates" label="Углеводы, г" value={profile.goals.carbohydrates} min={1} step="any" />
          </>}
        </>}
      </section>
    </fieldset>
    <div className="settings-save-bar">
      <button className="action w-full inline-flex items-center justify-center gap-2" type="submit" disabled={saving}>
        {saving && <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />}
        {saving ? 'Сохраняем…' : 'Сохранить настройки'}
      </button>
      <div className="settings-feedback" data-kind={feedback?.kind} role="status" aria-atomic="true">
        {!saving && feedback?.kind === 'success' && <CheckCircle2 size={18} aria-hidden="true" />}
        {!saving && feedback?.kind === 'error' && <CircleAlert size={18} aria-hidden="true" />}
        <span>{saving ? 'Обновляем профиль и меню…' : feedback?.message ?? 'Меню и доступные рекомендации применяются при сохранении.'}</span>
      </div>
    </div>
  </form>
}

function NumberField({ name, label, value, min, max, step = '1' }: {
  name: string; label: string; value: number; min: number; max?: number; step?: string
}) {
  return <label>{label}<input type="number" name={name} defaultValue={value} min={min} max={max} step={step} required /></label>
}
