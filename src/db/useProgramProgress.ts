import { useLiveQuery } from 'dexie-react-hooks'
import { addDays } from '../domain/dates'
import { mealSignature } from '../domain/energyBalance'
import { programProgress } from '../domain/program'
import { db, defaultProfile } from './database'

export function useProgramProgress(today: string) {
  return useLiveQuery(() => db.transaction('r', [
    db.profiles, db.programs, db.days, db.meals, db.intakeConfirmations, db.workouts, db.walks, db.weights,
  ], async () => {
    const profile = await db.profiles.get('profile') ?? defaultProfile
    const program = await db.programs.get('program')
    const recorded = { nutrition: new Set<string>(), workout: new Set<string>(), walking: new Set<string>(), weight: new Set<string>() }
    const saved = program ? await db.days.toArray() : []
    if (program && program.started <= today) {
      const end = addDays(program.started, profile.programDays - 1)
      const through = end < today ? end : today
      const [confirmations, meals, workouts, walks, weights] = await Promise.all([
        db.intakeConfirmations.where('date').between(program.started, through, true, true).toArray(),
        db.meals.where('date').between(program.started, through, true, true).toArray(),
        db.workouts.where('date').between(program.started, through, true, true).toArray(),
        db.walks.where('date').between(program.started, through, true, true).toArray(),
        db.weights.where('date').between(program.started, through, true, true).primaryKeys(),
      ])
      const mealsByDate = new Map<string, typeof meals>()
      for (const meal of meals) {
        const group = mealsByDate.get(meal.date) ?? []
        group.push(meal)
        mealsByDate.set(meal.date, group)
      }
      for (const { date, signature } of confirmations) {
        const entries = mealsByDate.get(date)
        if (entries?.length && mealSignature(entries) === signature) recorded.nutrition.add(date)
      }
      for (const row of workouts) if (row.finished) recorded.workout.add(row.date)
      for (const row of walks) recorded.walking.add(row.date)
      for (const date of weights) recorded.weight.add(date)
    }
    return { profile, program, saved, recorded, days: programProgress(program, saved, profile, today, recorded) }
  }), [today])
}
