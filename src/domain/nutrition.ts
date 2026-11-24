import { z } from 'zod'

export const nutrientsSchema = z.object({
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  carbohydrates: z.number().nonnegative(),
})
export const productSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1), source: z.string(), per100g: nutrientsSchema })
export const mealKinds = ['Завтрак', 'Обед', 'Перекус', 'Ужин'] as const
export const mealSchema = z.object({
  id: z.string().min(1), date: z.iso.date(), meal: z.enum(mealKinds),
  name: z.string().trim().min(1), grams: z.number().positive(), per100g: nutrientsSchema,
})
export const recipeSchema = z.object({
  id: z.string().min(1), name: z.string().trim().min(1), servings: z.number().int().positive(),
  yieldGrams: z.number().positive(), ingredients: z.array(z.object({ product: productSchema, grams: z.number().positive() })).nonempty(),
})

export type Nutrients = z.infer<typeof nutrientsSchema>
export type Product = z.infer<typeof productSchema>
export type Meal = z.infer<typeof mealSchema>
export type Recipe = z.infer<typeof recipeSchema>
export const emptyNutrients: Nutrients = { calories: 0, protein: 0, fat: 0, carbohydrates: 0 }

export function scaleNutrients(nutrients: Nutrients, ratio: number): Nutrients {
  return { calories: nutrients.calories * ratio, protein: nutrients.protein * ratio, fat: nutrients.fat * ratio, carbohydrates: nutrients.carbohydrates * ratio }
}

export function sumNutrients(values: Nutrients[]): Nutrients {
  return values.reduce((a, b) => ({ calories: a.calories + b.calories, protein: a.protein + b.protein, fat: a.fat + b.fat, carbohydrates: a.carbohydrates + b.carbohydrates }), emptyNutrients)
}

export function recipeNutrients(recipe: Recipe): Nutrients {
  return sumNutrients(recipe.ingredients.map(({ product, grams }) => scaleNutrients(product.per100g, grams / 100)))
}

export const nutrientLabels: Record<keyof Nutrients, string> = { calories: 'Калории, ккал', protein: 'Белки, г', fat: 'Жиры, г', carbohydrates: 'Углеводы, г' }
export const nutrientKeys = Object.keys(nutrientLabels) as (keyof Nutrients)[]
export const nutritionNumber = new Intl.NumberFormat('ru', { maximumFractionDigits: 1 })
