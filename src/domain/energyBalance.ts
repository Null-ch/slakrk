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

// 2024 Adult Compendium (17340–17367). Use level treadmill estimates at recorded pace.
const treadmill: readonly [upperSpeed: number, met: number][] = [
  [1.6, 2.1], [1.9, 2.3], [3.2, 2.8], [4, 3], [4.8, 3.5],
  [5.6, 3.8], [6.4, 4.8], [7.2, 5.8], [8, 6.8], [8.91, 8.3],
]

function activityEnergy(met: number, minutes: number, kg: number) {
  return (met - 1) * 3.5 * kg / 200 * minutes
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

  return confirmations.flatMap(({ date, signature }) => {
    const intake = mealsByDate.get(date)
    if (date > today || !intake?.length || mealSignature(intake) !== signature) return []
    const kg = timeline.find((item) => item.date <= date)?.kg ?? profile.startingWeightKg
    const input = planInputSchema.safeParse({ ...profile, startingWeightKg: kg })
    if (!input.success) return []
    const baseline = estimatePlan(input.data, 'gentle').maintenance
    const calories = intake.reduce((sum, row) => sum + row.grams * row.per100g.calories / 100, 0)
    let training = 0
    let missing = 0
    for (const walk of walksByDate.get(date) ?? []) {
      const band = treadmill.find(([upperSpeed]) => walk.speed < upperSpeed)
      if (band && walk.minutes <= 240) training += activityEnergy(band[1], walk.minutes, kg)
      else missing++
    }
    for (const workout of workoutsByDate.get(date) ?? []) {
      if (workout.minutes) training += activityEnergy(3.5, workout.minutes, kg)
      else missing++
    }
    return [{ date, calories, baseline, training, missing, deficit: baseline + training - calories }]
  }).sort((a, b) => b.date.localeCompare(a.date))
}
