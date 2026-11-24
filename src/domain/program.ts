import { z } from 'zod'
import type { ActivityLevel } from './personalPlan'

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

const schedule: [string, string][] = [
  ['А', '10'], ['', '20'], ['Б', '10'], ['', '20'], ['А', '10'], ['', '20–25'], ['', ''],
  ['Б', '15'], ['', '25'], ['А', '15'], ['', '25'], ['Б', '15'], ['', '30'], ['', ''],
  ['А', '15'], ['', '30'], ['Б', '15'], ['', '30–35'], ['А', '15'], ['', '35–40'], ['', ''],
]

export function planForDay(number: number, beginner = false, level?: ActivityLevel) {
  if (beginner && level === 'gentle' && number >= 1 && number <= 21) {
    const weekday = (number - 1) % 7
    const kind = weekday === 0 ? 'А' : weekday === 3 ? 'Б' : ''
    return { kind, minutes: [0, 2, 3, 5].includes(weekday) ? '5–10' : '', speed: 'комфортный темп', incline: '0' }
  }
  const [kind, minutes] = schedule[number - 1] ?? ['', '']
  if (beginner) return { kind, minutes: minutes ? level === 'regular' ? kind ? '15' : '20' : kind ? '10' : '15' : '', speed: 'комфортный темп', incline: '0' }
  const week = Math.ceil(number / 7)
  return { kind, minutes, speed: week === 1 ? '3–3,5' : week === 2 ? '3,5–4' : '3,5–4,5', incline: week === 1 ? '0' : week === 2 ? '0–2' : '0–3' }
}

export function isClosed(day: ProgramDay) { return day.status !== 'В процессе' }

export function activeDayNumber(days: ProgramDay[], limit: number): number | undefined {
  const closed = new Set(days.filter(isClosed).map((day) => day.number))
  return Array.from({ length: limit }, (_, index) => index + 1).find((number) => !closed.has(number))
}
