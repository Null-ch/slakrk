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

export const activityLevels = ['gentle', 'starter', 'regular'] as const
export type ActivityLevel = typeof activityLevels[number]

export const activityOptions: Record<ActivityLevel, { label: string; factor: number; sets: number; walk: string }> = {
  gentle: { label: 'Почти не двигаюсь', factor: 1.2, sets: 1, walk: '5–10' },
  starter: { label: 'Гуляю время от времени', factor: 1.2, sets: 2, walk: '10–15' },
  regular: { label: 'Регулярно хожу и тренируюсь', factor: 1.4, sets: 2, walk: '15–20' },
}

export function estimatePlan(input: PlanInput, level: ActivityLevel = 'starter') {
  const resting = 10 * input.startingWeightKg + 6.25 * input.heightCm - 5 * input.ageYears + (input.sex === 'Мужской' ? 5 : -161)
  const maintenance = Math.round(resting * activityOptions[level].factor)
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

export function recommendPlan(profile: PlanInput & { recommendationActivity?: ActivityLevel; medicalRestrictions?: string | null }, date: string) {
  const input = planInputSchema.safeParse(profile)
  if (!input.success || profile.medicalRestrictions?.trim()) return undefined
  const level = profile.recommendationActivity ?? 'starter'
  const estimate = estimatePlan(input.data, level)
  if (estimate.bmi < 18.5) return undefined
  const menu = plannedMenu(date, estimate.calories)
  const nutrients = menuNutrients(menu)
  return {
    ...estimate, level, menuCalories: Math.round(nutrients.calories),
    goals: { calories: estimate.calories, protein: Math.round(nutrients.protein), fat: Math.round(nutrients.fat), carbohydrates: Math.round(nutrients.carbohydrates) },
  }
}

export function menuNutrients(menu: Ingredient[][]) {
  return sumNutrients(menu.flat().flatMap((item) => {
    const product = foods.get(item.name)
    return item.grams && product ? [scaleNutrients(product.per100g, item.grams / 100)] : []
  }))
}
