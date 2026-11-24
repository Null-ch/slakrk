import { z } from 'zod'
import { addDays } from './dates'

export const exerciseSchema = z.object({ name: z.string().trim().min(1), technique: z.string().trim().min(1), target: z.string().trim().min(1) })
export const workoutSchema = z.object({
  id: z.string().min(1), date: z.iso.date(), kind: z.enum(['А', 'Б']), finished: z.boolean(),
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

export const exercisePrograms: Record<Workout['kind'], z.infer<typeof exerciseSchema>[]> = {
  А: [
    { name: 'Приседания на стул', target: '8–12', technique: 'Отводи таз назад, коснись стула и поднимись с опорой на всю стопу.' },
    { name: 'Сгибание рук с гантелями', target: '10–12', technique: 'Держи локти у корпуса, поднимай и опускай гантели плавно.' },
    { name: 'Отжимания от стены', target: '10–12', technique: 'Ладони на стене на уровне плеч. Сгибай руки, сохраняя корпус прямым.' },
    { name: 'Жим гантелей вверх', target: '8–10', technique: 'Удерживай корпус ровно, выжимай гантели вверх без прогиба в пояснице.' },
    { name: 'Подъёмы на носки', target: '12–15', technique: 'Можно держаться за опору. Поднимай пятки и плавно опускай их.' },
  ],
  Б: [
    { name: 'Ягодичный мостик', target: '12–15', technique: 'Лёжа на спине, согни колени и поднимай таз, опираясь на стопы.' },
    { name: 'Тяга гантели одной рукой', target: '10–12 на руку', technique: 'Опрись свободной рукой, держи спину ровной, тяни локоть к боку.' },
    { name: 'Разгибание ноги сидя', target: '12 на ногу', technique: 'Выпрямляй ногу сидя и плавно возвращай её в исходное положение.' },
    { name: 'Птица-собака', target: '8–10 на сторону', technique: 'На четвереньках вытяни противоположные руку и ногу, удерживая таз ровно.' },
    { name: 'Разведение рук в стороны', target: '10–12', technique: 'Слегка согни локти. Поднимай руки в стороны без рывков и опускай плавно.' },
  ],
}
