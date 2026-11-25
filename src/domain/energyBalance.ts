import { z } from 'zod'
import type { Profile, Weight } from '../db/database'
import type { Walk, Workout } from './activity'
import type { Meal } from './nutrition'
import { estimatePlan, planInputSchema } from './personalPlan'

export const intakeConfirmationSchema = z.object({ date: z.iso.date(), signature: z.string().min(1) })
export type IntakeConfirmation = z.infer<typeof intakeConfirmationSchema>

// Approximate reference energy equivalent, independent of actual changes on the scale.
export const kcalPerKgEquivalent = 7700

export function mealSignature(meals: Meal[]): string {
  return JSON.stringify(meals.map(({ id, name, grams, per100g }) => JSON.stringify([id, name, grams, per100g.calories])).sort())
}

function activityEnergy(met: number, minutes: number, kg: number) {
  return (met - 1) * 3.5 * kg / 200 * minutes
}

function treadmillEnergy(walk: Walk, kg: number) {
  // ACSM walking equation, with resting oxygen consumption already subtracted.
  const metersPerMinute = walk.speed * 1000 / 60
  const grade = (walk.incline ?? 0) / 100
  const netOxygen = metersPerMinute * (0.1 + 1.8 * grade)
  return netOxygen * kg * walk.minutes / 200
}

function byDate<T extends { date: string }>(rows: T[]) {
  const result = new Map<string, T[]>()
  for (const row of rows) {
    const group = result.get(row.date)
    if (group) group.push(row)
    else result.set(row.date, [row])
  }
  return result
}

export function energyBalanceDays({
  profile, weights, meals, walks, workouts, confirmations, today,
}: {
  profile: Profile; weights: Weight[]; meals: Meal[]; walks: Walk[]; workouts: Workout[];
  confirmations: IntakeConfirmation[]; today: string
}) {
  const mealsByDate = byDate(meals)
  const walksByDate = byDate(walks)
  const workoutsByDate = byDate(workouts.filter(({ finished }) => finished))
  const timeline = [...weights].sort((a, b) => b.date.localeCompare(a.date))
  const signatures = new Map(confirmations.map(({ date, signature }) => [date, signature]))
  const dates = [...new Set([...signatures.keys(), ...walksByDate.keys()])].sort().reverse()

  return dates.flatMap((date) => {
    const intake = mealsByDate.get(date)
    const confirmed = Boolean(intake?.length && mealSignature(intake) === signatures.get(date))
    const dayWalks = walksByDate.get(date) ?? []
    if (date > today || (!confirmed && !dayWalks.length)) return []
    const kg = timeline.find((item) => item.date <= date)?.kg ?? profile.startingWeightKg
    const input = planInputSchema.safeParse({ ...profile, startingWeightKg: kg })
    if (!input.success) return []
    const baseline = estimatePlan(input.data, 'gentle').maintenance
    const calories = intake?.reduce((sum, row) => sum + row.grams * row.per100g.calories / 100, 0) ?? null
    const treadmill = dayWalks.reduce((sum, walk) => sum + treadmillEnergy(walk, kg), 0)
    let training = treadmill
    let missing = 0
    for (const workout of workoutsByDate.get(date) ?? []) {
      if (workout.minutes) training += activityEnergy(3.5, workout.minutes, kg)
      else missing++
    }
    const deficit = calories === null ? null : baseline + training - calories
    return [{ date, calories, baseline, treadmill, training, missing, confirmed, deficit }]
  })
}
