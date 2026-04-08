import { format, addMinutes, parse, isAfter, isBefore, isEqual } from 'date-fns'

export const formatCurrency = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

export function formatDuration(minutes) {
  if (!minutes) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function generateSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
}

export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export const getDayName  = (i) => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][i]
export const getDayShort = (i) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]

/**
 * Parse a date string "yyyy-MM-dd" without timezone shift.
 * Using new Date("2024-01-15") is UTC midnight → shows Jan 14 in US timezones.
 * This fixes it by parsing as local time.
 */
export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date()
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Format a stored dateStr "yyyy-MM-dd" for display — no timezone shift.
 */
export function formatLocalDate(dateStr, fmt = 'MMM d, yyyy') {
  return format(parseLocalDate(dateStr), fmt)
}

/**
 * Check if an appointment's date+time is in the past.
 */
export function isAppointmentPast(date, startTime) {
  if (!date || !startTime) return false
  const d = parseLocalDate(date)
  const [h, m] = startTime.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d < new Date()
}

/**
 * Get today as "yyyy-MM-dd" string in LOCAL timezone (no UTC shift).
 */
export function todayStr() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function generateTimeSlots(startTime, endTime, durationMinutes, breaks = [], existingBookings = []) {
  const slots = []
  const base  = new Date(2000, 0, 1)
  const pt    = (t) => parse(t, 'HH:mm', base)
  let cur     = pt(startTime)
  const end   = pt(endTime)

  while (isBefore(addMinutes(cur, durationMinutes), end) || isEqual(addMinutes(cur, durationMinutes), end)) {
    const ss = format(cur, 'HH:mm')
    const se = format(addMinutes(cur, durationMinutes), 'HH:mm')
    const sd = pt(ss), ed = pt(se)

    const inBreak   = breaks.some(b => isBefore(sd, pt(b.endTime)) && isAfter(ed, pt(b.startTime)))
    const inBooking = existingBookings.some(b => isBefore(sd, pt(b.endTime)) && isAfter(ed, pt(b.startTime)))

    if (!inBreak && !inBooking) slots.push({ startTime: ss, endTime: se })
    cur = addMinutes(cur, 15)
  }
  return slots
}
