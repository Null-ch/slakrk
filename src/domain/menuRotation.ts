import type { MenuOverride } from '../data/meals'

export const menuStyles = ['mixed', 'no-fish', 'vegetarian'] as const
export type MenuStyle = typeof menuStyles[number]
export const menuStyleLabels: Record<MenuStyle, string> = {
  mixed: 'С мясом и рыбой', 'no-fish': 'Без рыбы', vegetarian: 'Без мяса и рыбы, с яйцами и молочным',
}

type Ingredient = MenuOverride['meals'][number][number]
const food = (category: string, name: string, grams: number): Ingredient => ({ category, name, grams })
const grain = (name: string, g: number) => food('Крупы и макароны', name, g)
const veg = (name: string, g: number) => food('Овощи', name, g)
const fruit = (name: string, g: number) => food('Фрукты', name, g)
const yogurt = (g: number) => food('Молочные продукты', 'Греческий йогурт, без сахара', g)
const cottage = (g: number) => food('Молочные продукты', 'Зернёный творог 2%', g)
const egg = (g: number) => food('Яйца', 'Яйца', g)
const bread = (g: number) => food('Прочее', 'Цельнозерновой хлеб', g)
const chicken = (g: number) => food('Мясо и птица', 'Куриная грудка', g)
const turkey = (g: number) => food('Мясо и птица', 'Грудка индейки', g)
const oil = (g: number) => food('Орехи и масла', 'Оливковое масло', g)
const lentils = (g: number) => food('Прочее', 'Чечевица варёная', g)
const chickpeas = (g: number) => food('Прочее', 'Нут варёный', g)
const tofu = (g: number) => food('Прочее', 'Тофу плотный', g)
const fish = (name: string, g: number) => food('Рыба', name, g)

const breakfasts = [
  [grain('Овсянка', 60), yogurt(180), fruit('Черника', 110)],
  [bread(85), egg(100), veg('Помидоры', 140), fruit('Апельсин', 150)],
  [cottage(200), fruit('Банан', 150), grain('Овсянка', 45)],
  [grain('Гречка', 65), egg(100), veg('Шпинат', 60), veg('Помидоры', 120)],
  [yogurt(230), fruit('Яблоко', 150), grain('Овсянка', 55)],
  [bread(80), cottage(170), fruit('Авокадо', 70), veg('Огурец', 120)],
  [egg(100), bread(60), veg('Шпинат', 70), fruit('Апельсин', 140)],
] as const

const snacks = [
  [cottage(150), fruit('Яблоко', 150)],
  [yogurt(180), fruit('Черника', 120)],
  [yogurt(150), fruit('Банан', 140)],
  [cottage(160), fruit('Апельсин', 180)],
] as const

const sides = [
  [grain('Булгур сухой', 75), veg('Огурец', 110), veg('Помидоры', 100)],
  [grain('Гречка', 70), veg('Морковь', 150)],
  [veg('Картофель', 290), veg('Брокколи', 140)],
  [grain('Рис', 70), veg('Шпинат', 100), veg('Помидоры', 100)],
  [grain('Макароны цельнозерновые сухие', 75), veg('Помидоры', 160)],
  [grain('Булгур сухой', 70), veg('Брокколи', 160)],
  [veg('Картофель', 280), veg('Морковь', 120), veg('Огурец', 100)],
] as const

export function variedMenu(date: string, style: MenuStyle): Ingredient[][] | undefined {
  const dayIndex = Math.floor(Date.parse(date) / 86_400_000)
  if (!Number.isFinite(dayIndex)) return undefined
  const at = <T,>(items: readonly [T, ...T[]], index: number) =>
    items[((index % items.length) + items.length) % items.length] ?? items[0]
  const week = Math.floor(dayIndex / 7)
  const plant = [lentils(220), tofu(175), chickpeas(200), egg(120)] as const
  const meat = [chicken(160), turkey(165), lentils(200)] as const
  const proteins = style === 'vegetarian' ? plant : meat
  const evening = style === 'mixed'
    ? [fish('Треска', 190), chickpeas(205), fish('Лосось', 155), turkey(160), tofu(165)] as const
    : style === 'no-fish' ? [turkey(155), chickpeas(205), chicken(155), tofu(165)] as const : [tofu(165), chickpeas(200), egg(120), lentils(210)] as const
  const lunch = at(proteins, dayIndex)
  const different = evening.filter((item) => item.name !== lunch.name)
  const dinner = at(evening, dayIndex + 1)
  return [
    [...at(breakfasts, dayIndex + week)],
    [lunch, ...at(sides, dayIndex), oil(12)],
    [...at(snacks, dayIndex)],
    [dinner.name === lunch.name ? different[0] ?? dinner : dinner, ...at(sides, dayIndex + 3 + week % 3), oil(12)],
  ]
}
