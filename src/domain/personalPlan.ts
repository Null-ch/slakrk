import { z } from 'zod'
import { menuForDate, referenceProducts, type MenuOverride } from '../data/meals'
import { calculateBmi } from './calculations'
import { scaleNutrients, sumNutrients } from './nutrition'

export const planInputSchema = z.object({
  startingWeightKg: z.number().min(35).max(300),
  heightCm: z.number().min(130).max(230),
  ageYears: z.number().int().min(18).max(78),
  sex: z.enum(['Мужской', 'Женский']),
})
export type PlanInput = z.infer<typeof planInputSchema>

export function estimatePlan(input: PlanInput) {
  const resting = 10 * input.startingWeightKg + 6.25 * input.heightCm - 5 * input.ageYears + (input.sex === 'Мужской' ? 5 : -161)
  const maintenance = Math.round(resting * 1.2)
  const bmi = calculateBmi(input.startingWeightKg, input.heightCm)
  const floor = input.sex === 'Мужской' ? 1600 : 1400
  const reduction = bmi >= 25 ? Math.min(300, Math.floor(maintenance * 0.1), Math.max(0, maintenance - floor)) : 0
  return { maintenance, calories: Math.max(floor, maintenance - reduction), reduction, bmi }
}

type Ingredient = MenuOverride['meals'][number][number]
const foods = new Map(referenceProducts.map((item) => [item.name, item]))
const portion = (name: string, grams: number, category: string): Ingredient => ({ name, grams, category })
const grain = (name: string, grams: number) => portion(name, grams, 'Крупы и макароны')
const fruit = (name: string, grams: number) => portion(name, grams, 'Фрукты')
const veg = (name: string, grams: number) => portion(name, grams, 'Овощи')
const oil = (grams: number) => portion('Оливковое масло', grams, 'Орехи и масла')
const variants = [
  ['Гречка', 'Треска', 'Банан'], ['Рис', 'Лосось', 'Яблоко'], ['Гречка', 'Лосось', 'Яблоко'],
  ['Рис', 'Треска', 'Банан'], ['Гречка', 'Треска', 'Яблоко'], ['Рис', 'Лосось', 'Банан'], ['Гречка', 'Лосось', 'Банан'],
] as const

export function plannedMenu(date: string, calories?: number): Ingredient[][] {
  if (!calories) return menuForDate(date)
  const [starch, fish, snack] = variants[new Date(date + 'T12:00:00').getDay()] ?? variants[0]
  const template = [
    [grain('Овсянка', 70), portion('Яйца', 100, 'Яйца'), fruit('Яблоко', 130)],
    [portion('Куриная грудка', 170, 'Мясо и птица'), grain(starch, 90), veg('Брокколи', 160), oil(15)],
    [fruit(snack, 180), portion('Авокадо', 90, 'Фрукты'), portion('Греческий йогурт, без сахара', 200, 'Молочные продукты')],
    [portion(fish, 170, 'Рыба'), veg('Картофель', 280), veg('Помидоры', 160), oil(15)],
  ]
  const total = menuNutrients(template).calories
  const multiplier = Math.min(1.65, Math.max(0.7, calories / total))
  return template.map((meal) => meal.map((item) => ({ ...item, grams: Math.round((item.grams ?? 0) * multiplier / 5) * 5 })))
}

export function menuNutrients(menu: Ingredient[][]) {
  return sumNutrients(menu.flat().flatMap((item) => {
    const product = foods.get(item.name)
    return item.grams && product ? [scaleNutrients(product.per100g, item.grams / 100)] : []
  }))
}
