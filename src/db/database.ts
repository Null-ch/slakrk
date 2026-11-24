import Dexie, { type EntityTable } from 'dexie'
import { z } from 'zod'
import { referenceProducts, type MenuOverride } from '../data/meals'
import type { Meal, Product, Recipe } from '../domain/nutrition'
import type { Walk, Workout } from '../domain/activity'
import type { Program, ProgramDay, ShoppingItem } from '../domain/program'
import type { Reminder } from '../domain/reminders'
import { activityLevels } from '../domain/personalPlan'
import { initialNutritionGoals, initialProfile } from '../data/profile'

export const profileSchema = z.object({
  id: z.literal('profile'),
  sex: z.enum(['Мужской', 'Женский']),
  ageYears: z.number().int().min(18).max(120),
  heightCm: z.number().positive().max(300),
  startingWeightKg: z.number().positive().max(1000),
  activity: z.string().trim().min(1),
  averageStepsUpTo: z.number().int().nonnegative(),
  experience: z.string().trim().min(1),
  medicalRestrictions: z.string().nullable(),
  programDays: z.number().int().min(1).max(365),
  theme: z.enum(['light', 'dark']),
  autoPlan: z.boolean().optional(),
  recommendationActivity: z.enum(activityLevels).optional(),
  appliedActivity: z.enum(activityLevels).optional(),
  estimatedMaintenance: z.number().positive().optional(),
  goals: z.object({
    calories: z.number().positive(),
    protein: z.number().positive(),
    fat: z.number().positive(),
    carbohydrates: z.number().positive(),
  }),
})

export const weightSchema = z.object({
  date: z.iso.date(),
  kg: z.number().positive().max(1000),
  waistCm: z.number().positive().max(500).optional(),
})

export type Profile = z.infer<typeof profileSchema>
export type Weight = z.infer<typeof weightSchema>

export const defaultProfile: Profile = {
  ...initialProfile,
  id: 'profile',
  theme: 'light',
  goals: { ...initialNutritionGoals },
}

class AppDatabase extends Dexie {
  profiles!: EntityTable<Profile, 'id'>
  weights!: EntityTable<Weight, 'date'>
  products!: EntityTable<Product, 'id'>
  meals!: EntityTable<Meal, 'id'>
  recipes!: EntityTable<Recipe, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  walks!: EntityTable<Walk, 'id'>
  programs!: EntityTable<Program, 'id'>
  days!: EntityTable<ProgramDay, 'number'>
  shopping!: EntityTable<ShoppingItem, 'id'>
  reminders!: EntityTable<Reminder, 'id'>
  menuOverrides!: EntityTable<MenuOverride, 'date'>

  constructor(accountId: string) {
    super('stop-jir-account-' + accountId)
    this.version(1).stores({ profiles: 'id', weights: 'date' })
    this.version(2).stores({ products: 'id,name', meals: 'id,date', recipes: 'id,name' })
      .upgrade((tx) => tx.table('products').bulkAdd(referenceProducts))
    this.version(3).stores({ workouts: 'id,date', walks: 'id,date' })
    this.version(4).stores({ programs: 'id', days: 'number,date', shopping: 'id,week' })
    this.version(5).stores({ reminders: 'id' })
    this.version(6).stores({ menuOverrides: 'date' })
    this.version(7).stores({}).upgrade((tx) => tx.table('products').bulkPut(referenceProducts.slice(-1)))
    this.on('populate', async () => {
      await this.products.bulkAdd(referenceProducts)
    })
  }
}

export let db: AppDatabase
let currentId: string | undefined

export function initializeAccount(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid account identifier')
  if (currentId === id) return
  db?.close()
  db = new AppDatabase(id)
  currentId = id
}
