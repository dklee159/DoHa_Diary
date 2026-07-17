const MS_PER_DAY = 86_400_000
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(date: string, n: number): string {
  return new Date(toUtc(date) + n * MS_PER_DAY).toISOString().slice(0, 10)
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / MS_PER_DAY)
}

export function todayStr(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function fmtMonthDay(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일`
}

export function fmtFull(date: string): string {
  const weekday = WEEKDAYS[new Date(toUtc(date)).getUTCDay()]
  return `${fmtMonthDay(date)} (${weekday})`
}

export interface CalendarCell {
  date: string
  inMonth: boolean
}

// 해당 월을 포함하는 주 단위 셀 목록 (일요일 시작)
export function calendarCells(year: number, month: number): CalendarCell[] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const firstDow = new Date(toUtc(first)).getUTCDay()
  const start = addDays(first, -firstDow)

  const cells: CalendarCell[] = []
  let cursor = start
  do {
    for (let i = 0; i < 7; i++) {
      cells.push({ date: cursor, inMonth: Number(cursor.split('-')[1]) === month })
      cursor = addDays(cursor, 1)
    }
  } while (Number(cursor.split('-')[1]) === month)
  return cells
}
