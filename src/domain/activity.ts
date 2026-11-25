import { z } from 'zod'
import { addDays } from './dates'

export const exerciseSchema = z.object({ name: z.string().trim().min(1), technique: z.string().trim().min(1), target: z.string().trim().min(1) })
export const workoutSchema = z.object({
  id: z.string().min(1), date: z.iso.date(), kind: z.enum(['А', 'Б']), finished: z.boolean(),
  equipment: z.literal(true).optional(),
  restSeconds: z.number().int().positive(),
  minutes: z.number().int().min(1).max(180).optional(),
  exercises: z.array(exerciseSchema.extend({ reps: z.array(z.number().int().nonnegative().nullable()).nonempty() })).nonempty(),
})
export const walkSchema = z.object({
  id: z.string().min(1), date: z.iso.date(), minutes: z.number().positive(), speed: z.number().positive(),
  incline: z.number().min(0).max(100), distance: z.number().positive(),
  effort: z.enum(['Легко', 'Умеренно', 'Тяжело']), comment: z.string(),
})
export type Workout = z.infer<typeof workoutSchema>
export type Walk = z.infer<typeof walkSchema>

export function monday(date: string): string {
  return addDays(date, -((new Date(date + 'T12:00:00').getDay() + 6) % 7))
}

type Exercise = z.infer<typeof exerciseSchema>

export const exercisePrograms: Record<Workout['kind'], Exercise[]> = {
  А: [
    { name: 'Приседания с собственным весом', target: '8–10', technique: 'Поставьте стопы на ширине плеч. Отведите таз назад, согните колени до удобной глубины и плавно выпрямитесь.' },
    { name: 'Отжимания от стены', target: '10–12', technique: 'Поставьте ладони на стену на уровне плеч. Сгибайте руки, сохраняя корпус прямым.' },
    { name: 'Подъёмы на носки', target: '12–15', technique: 'Поставьте стопы параллельно. Поднимите пятки и плавно опустите их.' },
  ],
  Б: [
    { name: 'Ягодичный мостик', target: '12–15', technique: 'Лёжа на спине, согните колени и поднимите таз, опираясь на стопы.' },
    { name: 'Птица-собака', target: '8–10 на сторону', technique: 'На четвереньках вытяните противоположные руку и ногу, удерживая таз ровно.' },
    { name: 'Наклоны с отведением таза', target: '8–10', technique: 'Слегка согните колени. Отведите таз назад, наклонитесь с ровной спиной и плавно выпрямитесь.' },
  ],
}

export const equipmentPrograms: Record<Workout['kind'], Exercise[]> = {
  А: [
    { name: 'Сгибание рук с гантелями', target: '10–12', technique: 'Держите локти у корпуса, поднимайте и опускайте гантели плавно.' },
    { name: 'Жим гантелей вверх', target: '8–10', technique: 'Начните с гантелей у плеч. Поднимайте их без прогиба в пояснице.' },
  ],
  Б: [
    { name: 'Тяга гантели одной рукой', target: '10–12 на руку', technique: 'Опритесь свободной рукой на устойчивую поверхность. Держите спину ровной и тяните локоть к боку.' },
    { name: 'Разведение рук с гантелями', target: '10–12', technique: 'Слегка согните локти. Поднимайте руки в стороны без рывков и опускайте плавно.' },
  ],
}
