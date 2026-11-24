import { z } from 'zod'
import { addDays, localDate } from './dates'

export const reminderNames = ['Взвешивание', 'Завтрак', 'Обед', 'Ужин', 'Ходьба', 'Силовая тренировка', 'Подготовка продуктов'] as const
export const reminderSchema = z.object({ id: z.enum(reminderNames), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), enabled: z.boolean() })
export type Reminder = z.infer<typeof reminderSchema>

export function reminderCalendar(reminders: Reminder[], now = new Date()): string {
  const today = localDate(now)
  const currentTime = now.toTimeString().slice(0, 5)
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stop Jir//Reminders//RU',
    ...reminders.filter(({ enabled }) => enabled).flatMap(({ id, time }) => [
      'BEGIN:VEVENT', 'UID:' + crypto.randomUUID() + '@stop-jir',
      'DTSTAMP:' + stamp, 'DTSTART:' + (time < currentTime ? addDays(today, 1) : today).replaceAll('-', '') + 'T' + time.replace(':', '') + '00',
      'RRULE:FREQ=DAILY', 'SUMMARY:' + id, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + id, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT',
    ]), 'END:VCALENDAR', ''].join('\r\n')
}
