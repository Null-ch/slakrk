export function localDate(date = new Date()): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

export function addDays(date: string, amount: number): string {
  const value = new Date(date + 'T12:00:00')
  value.setDate(value.getDate() + amount)
  return localDate(value)
}

export function dateLabel(date: string): string {
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date + 'T12:00:00'))
}
