import { z } from 'zod'
import type { Product } from '../domain/nutrition'

const ingredientSchema = z.object({ name: z.string().trim().min(1), category: z.string().trim().min(1), grams: z.number().positive().optional(), units: z.number().int().positive().optional() })
export const menuOverrideSchema = z.object({ date: z.iso.date(), meals: z.array(z.array(ingredientSchema)).length(4) })
export type MenuOverride = z.infer<typeof menuOverrideSchema>
type PlanIngredient = z.infer<typeof ingredientSchema>

function ingredient(name: string, category: string, grams?: number, units?: number): PlanIngredient {
  return { name, category, grams, units }
}

const meat = (name: string, grams: number) => ingredient(name, 'Мясо и птица', grams)
const fish = (name: string, grams: number) => ingredient(name, 'Рыба', grams)
const dairy = (name: string, grams: number) => ingredient(name, 'Молочные продукты', grams)
const eggs = (units: number) => ingredient('Яйца', 'Яйца', undefined, units)
const grain = (name: string, grams: number) => ingredient(name, 'Крупы и макароны', grams)
const veg = (name = 'Овощи', grams?: number) => ingredient(name, 'Овощи', grams)
const fruit = (name: string, grams?: number, units?: number) => ingredient(name, 'Фрукты', grams, units)
const oil = (name: string, grams: number) => ingredient(name, 'Орехи и масла', grams)
const other = (name: string, grams?: number) => ingredient(name, 'Прочее', grams)
const curd = (grams = 200) => dairy('Творог', grams)
const yogurt = (grams: number) => dairy('Греческий йогурт', grams)
const potato = (grams: number) => veg('Картофель', grams)
const bread = (grams: number) => other('Хлеб', grams)
const chicken = (grams: number) => meat('Курица', grams)

export const weeklyMenu: PlanIngredient[][][] = [
  [
    [grain('Овсянка', 60), eggs(2), fruit('Банан', 100)],
    [meat('Куриная грудка', 200), grain('Гречка', 70), veg('Овощи', 200), oil('Оливковое масло', 5)],
    [curd(), fruit('Яблоко', undefined, 1)],
    [fish('Треска', 220), potato(250), veg('Брокколи', 200), oil('Масло', 10)],
  ],
  [
    [eggs(3), other('Цельнозерновой хлеб', 60), veg('Помидоры')],
    [meat('Индейка', 200), grain('Рис', 70), veg('Овощи', 200)],
    [yogurt(250), fruit('Банан', undefined, 1)],
    [meat('Куриные бёдра без кожи', 200), potato(200), veg('Салат')],
  ],
  [
    [curd(), eggs(1), other('Мука', 30)],
    [meat('Нежирная говядина', 180), grain('Гречка', 70), veg()],
    [yogurt(200), fruit('Ягоды', 100)],
    [fish('Лосось', 150), grain('Рис', 50), veg('Овощи', 200)],
  ],
  [
    [eggs(3), bread(60), fruit('Авокадо', 40)],
    [chicken(200), potato(250), veg('Салат')],
    [curd(), fruit('Ягоды')],
    [meat('Фрикадельки из индейки', 200), grain('Макароны из твёрдых сортов', 70), other('Томатный соус')],
  ],
  [
    [grain('Овсянка', 60), fruit('Яблоко', undefined, 1), eggs(2)],
    [chicken(200), grain('Рис', 70), veg()],
    [yogurt(200), oil('Орехи', 15)],
    [fish('Треска', 220), potato(250), veg('Салат')],
  ],
  [
    [eggs(3), veg('Грибы'), dairy('Сыр', 20), bread(50)],
    [meat('Говяжья котлета', 180), grain('Рис', 60), veg('Салат')],
    [curd(), fruit('Банан')],
    [meat('Куриные голени без кожи', 220), veg('Овощи', 250), potato(150)],
  ],
  [
    [yogurt(250), grain('Овсянка', 50), fruit('Ягоды')],
    [meat('Индейка', 200), grain('Гречка', 70), veg()],
    [curd(), fruit('Фрукт')],
    [fish('Рыба', 200), potato(200), veg()],
  ],
]

export function menuForDate(date: string) {
  return weeklyMenu[(new Date(date + 'T12:00:00').getDay() + 6) % 7] ?? []
}

// Reference values are approximations rounded from USDA FoodData Central SR Legacy.
const source = 'USDA FoodData Central · SR Legacy'
const references: [string, number, number, number, number][] = [
  ['Овсянка', 379, 13.2, 6.5, 67.7],
  ['Яйца', 143, 12.6, 9.5, 0.7],
  ['Банан', 89, 1.1, 0.3, 22.8],
  ['Яблоко', 52, 0.3, 0.2, 13.8],
  ['Куриная грудка', 120, 22.5, 2.6, 0],
  ['Гречка', 343, 13.3, 3.4, 71.5],
  ['Оливковое масло', 884, 0, 100, 0],
  ['Треска', 82, 17.8, 0.7, 0],
  ['Картофель', 77, 2, 0.1, 17.5],
  ['Брокколи', 34, 2.8, 0.4, 6.6],
  ['Помидоры', 18, 0.9, 0.2, 3.9],
  ['Рис', 365, 7.1, 0.7, 80],
  ['Авокадо', 160, 2, 14.7, 8.5],
  ['Лосось', 208, 20.4, 13.4, 0],
  ['Греческий йогурт, без сахара', 59, 10.2, 0.4, 3.6],
]

export const referenceProducts: Product[] = references.map(([name, calories, protein, fat, carbohydrates], index) => ({
  id: 'ref-' + index, name, source, per100g: { calories, protein, fat, carbohydrates },
}))
