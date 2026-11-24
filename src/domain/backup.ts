import { z } from 'zod'
import { db, profileSchema, weightSchema } from '../db/database'
import { mealSchema, productSchema, recipeSchema } from './nutrition'
import { walkSchema, workoutSchema } from './activity'
import { daySchema, programSchema, shoppingSchema } from './program'
import { reminderSchema } from './reminders'
import { menuOverrideSchema } from '../data/meals'

const backupSchema = z.object({
  version: z.literal(1), profile: profileSchema, weights: z.array(weightSchema),
  products: z.array(productSchema), meals: z.array(mealSchema), recipes: z.array(recipeSchema),
  workouts: z.array(workoutSchema), walks: z.array(walkSchema),
  programs: z.array(programSchema).max(1), days: z.array(daySchema), shopping: z.array(shoppingSchema),
  reminders: z.array(reminderSchema).default([]), menuOverrides: z.array(menuOverrideSchema).default([]),
})
type Backup = z.infer<typeof backupSchema>

export async function exportBackup(): Promise<Backup> {
  return db.transaction('r', db.tables, async () => {
    const [profile, weights, products, meals, recipes, workouts, walks, programs, days, shopping, reminders, menuOverrides] = await Promise.all([
      db.profiles.get('profile'), db.weights.toArray(), db.products.toArray(), db.meals.toArray(), db.recipes.toArray(),
      db.workouts.toArray(), db.walks.toArray(), db.programs.toArray(), db.days.toArray(), db.shopping.toArray(), db.reminders.toArray(), db.menuOverrides.toArray(),
    ])
    return backupSchema.parse({ version: 1, profile, weights, products, meals, recipes, workouts, walks, programs, days, shopping, reminders, menuOverrides })
  })
}

export function readBackup(text: string): Backup {
  const data = backupSchema.parse(JSON.parse(text))
  const uniqueness: (string | number)[][] = [
    data.weights.map(({ date }) => date), data.products.map(({ id }) => id), data.meals.map(({ id }) => id),
    data.recipes.map(({ id }) => id), data.workouts.map(({ id }) => id), data.walks.map(({ id }) => id),
    data.days.map(({ number }) => number), data.shopping.map(({ id }) => id), data.reminders.map(({ id }) => id), data.menuOverrides.map(({ date }) => date),
  ]
  if (uniqueness.some((keys) => new Set(keys).size !== keys.length)) throw new Error('Дублирующиеся ключи')
  return data
}

export async function importBackup(data: Backup): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
    await db.profiles.add(data.profile)
    await db.weights.bulkAdd(data.weights)
    await db.products.bulkAdd(data.products)
    await db.meals.bulkAdd(data.meals)
    await db.recipes.bulkAdd(data.recipes)
    await db.workouts.bulkAdd(data.workouts)
    await db.walks.bulkAdd(data.walks)
    await db.programs.bulkAdd(data.programs)
    await db.days.bulkAdd(data.days)
    await db.shopping.bulkAdd(data.shopping)
    await db.reminders.bulkAdd(data.reminders)
    await db.menuOverrides.bulkAdd(data.menuOverrides)
  })
}

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function csv(rows: (string | number | undefined)[][]): string {
  return '\ufeff' + rows.map((row) => row.map((value) => {
    const cell = typeof value === 'string' && /^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? "'" + value : String(value ?? '')
    return '"' + cell.replaceAll('"', '""') + '"'
  }).join(';')).join('\r\n')
}
