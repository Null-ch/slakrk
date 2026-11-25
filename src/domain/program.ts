import { z } from 'zod'
import { addDays } from './dates'
import { calculateBmi } from './calculations'
import type { Profile } from '../db/database'

export const taskKeys = ['nutrition', 'workout', 'walking', 'weight'] as const
export const taskNames = { nutrition: 'Питание', workout: 'Силовая тренировка', walking: 'Ходьба', weight: 'Взвешивание' }
export const daySchema = z.object({
  number: z.number().int().positive(),
  date: z.iso.date(),
  tasks: z.partialRecord(z.enum(taskKeys), z.boolean()),
  status: z.enum(['В процессе', 'Выполнен', 'Частично выполнен', 'Пропущен']),
  minutes: z.string().optional(),
  speed: z.string().optional(),
  incline: z.string().optional(),
})
export const programSchema = z.object({ id: z.literal('program'), started: z.iso.date() })
export const shoppingSchema = z.object({
  id: z.string().min(1), week: z.number().int().positive(), name: z.string().min(1), category: z.string().min(1),
  grams: z.number().positive().optional(), units: z.number().int().positive().optional(),
  unspecified: z.boolean().optional(), bought: z.boolean(), removed: z.boolean().optional(),
})

export type Program = z.infer<typeof programSchema>
export type ProgramDay = z.infer<typeof daySchema>
export type ShoppingItem = z.infer<typeof shoppingSchema>

export function trainingLoad(profile: Profile, number: number) {
  const level = profile.appliedActivity ?? profile.recommendationActivity ?? 'starter'
  const bmi = calculateBmi(profile.startingWeightKg, profile.heightCm)
  const gentle = level === 'gentle' || profile.ageYears >= 65 || bmi >= 35
  const week = Math.floor((number - 1) / 7)
  const progressing = week > 0 && profile.programDays >= 14
  return {
    gentle,
    sets: gentle ? 1 : progressing && level === 'regular' ? 3 : 2,
    restSeconds: gentle ? 90 : 75,
    target: gentle ? '6–8' : progressing ? '10–12' : '8–10',
    minutes: gentle ? '5–10' : progressing ? '15–20' : '10–15',
  }
}

export function planForDay(number: number, profile: Profile) {
  const load = trainingLoad(profile, number)
  const week = Math.floor((number - 1) / 7)
  const weekday = (number - 1) % 7
  const strengthDays = load.gentle || profile.programDays < 7 ? [0, 3] : [0, 2, 4]
  const index = strengthDays.indexOf(weekday)
  const kind = index < 0 ? undefined : (week * strengthDays.length + index) % 2 === 0 ? 'А' : 'Б'
  return { ...load, kind, minutes: [1, 3, 5].includes(weekday) ? load.minutes : '', speed: 'комфортный темп', incline: '0' }
}

type Task = typeof taskKeys[number]

export function programProgress(
  program: Program | undefined,
  saved: ProgramDay[],
  profile: Profile,
  today: string,
  recorded: Record<Task, Set<string>>,
) {
  if (!program) return []
  const byNumber = new Map(saved.map((day) => [day.number, day]))
  return Array.from({ length: profile.programDays }, (_, index): ProgramDay | undefined => {
    const number = index + 1
    const previous = byNumber.get(number)
    const date = addDays(program.started, index)
    if (date > today) return previous
    const tasks = { ...previous?.tasks }
    for (const key of taskKeys) {
      if (recorded[key].has(date)) tasks[key] = true
    }
    if (!previous && !Object.values(tasks).some(Boolean)) return undefined
    const complete = tasks.nutrition && (!planForDay(number, profile).kind || tasks.workout)
    return {
      ...previous, number, date: previous?.date ?? date, tasks,
      status: previous && isClosed(previous) ? previous.status : complete ? 'Выполнен' : 'В процессе',
    }
  }).filter((day): day is ProgramDay => day !== undefined)
}

export function isClosed(day: ProgramDay) { return day.status !== 'В процессе' }

export function activeDayNumber(days: ProgramDay[], limit: number): number | undefined {
  const closed = new Set(days.filter(isClosed).map((day) => day.number))
  return Array.from({ length: limit }, (_, index) => index + 1).find((number) => !closed.has(number))
}
