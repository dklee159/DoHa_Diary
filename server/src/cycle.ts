export interface PeriodRecord {
  start_date: string
  end_date: string | null
}

export interface CycleSettings {
  cycleLenOverride?: number | null
  periodLenOverride?: number | null
}

export const DEFAULT_CYCLE_LEN = 28
export const DEFAULT_PERIOD_LEN = 5
const MAX_INTERVALS = 6
const MS_PER_DAY = 86_400_000

// 모든 날짜는 'YYYY-MM-DD' 문자열. 타임존 영향을 피하기 위해 UTC로만 계산한다.
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

export interface CyclePrediction {
  cycleLen: number
  periodLen: number
  nextPeriodStart: string | null
  predictedPeriods: { start: string; end: string }[]
  fertileWindows: { start: string; end: string; ovulation: string }[]
  pmsWindows: { start: string; end: string }[]
}

export type DayStatus =
  | 'period'
  | 'ovulation'
  | 'fertile'
  | 'pms'
  | 'predicted_period'
  | 'none'

const PROJECTED_CYCLES = 3
const LUTEAL_PHASE_DAYS = 14
const FERTILE_BEFORE_OVULATION = 5
const FERTILE_AFTER_OVULATION = 1
const PMS_DAYS = 4

export function calcPredictions(
  periods: PeriodRecord[],
  settings: CycleSettings,
): CyclePrediction {
  const { cycleLen, periodLen } = calcAverages(periods, settings)
  const starts = periods.map((p) => p.start_date).sort()
  const lastStart = starts.length > 0 ? starts[starts.length - 1] : null

  const predictedPeriods: CyclePrediction['predictedPeriods'] = []
  const fertileWindows: CyclePrediction['fertileWindows'] = []
  const pmsWindows: CyclePrediction['pmsWindows'] = []

  if (lastStart) {
    for (let i = 1; i <= PROJECTED_CYCLES; i++) {
      const start = addDays(lastStart, cycleLen * i)
      predictedPeriods.push({ start, end: addDays(start, periodLen - 1) })

      const ovulation = addDays(start, -LUTEAL_PHASE_DAYS)
      fertileWindows.push({
        start: addDays(ovulation, -FERTILE_BEFORE_OVULATION),
        end: addDays(ovulation, FERTILE_AFTER_OVULATION),
        ovulation,
      })

      pmsWindows.push({ start: addDays(start, -PMS_DAYS), end: addDays(start, -1) })
    }
  }

  return {
    cycleLen,
    periodLen,
    nextPeriodStart: predictedPeriods.length > 0 ? predictedPeriods[0].start : null,
    predictedPeriods,
    fertileWindows,
    pmsWindows,
  }
}

// 'YYYY-MM-DD'는 사전순 비교가 곧 날짜순 비교다.
export function statusForDate(
  date: string,
  periods: PeriodRecord[],
  prediction: CyclePrediction,
): DayStatus {
  for (const p of periods) {
    const end = p.end_date ?? addDays(p.start_date, prediction.periodLen - 1)
    if (date >= p.start_date && date <= end) return 'period'
  }
  for (const f of prediction.fertileWindows) {
    if (date === f.ovulation) return 'ovulation'
  }
  for (const f of prediction.fertileWindows) {
    if (date >= f.start && date <= f.end) return 'fertile'
  }
  for (const w of prediction.pmsWindows) {
    if (date >= w.start && date <= w.end) return 'pms'
  }
  for (const w of prediction.predictedPeriods) {
    if (date >= w.start && date <= w.end) return 'predicted_period'
  }
  return 'none'
}

export function todaySummary(
  today: string,
  periods: PeriodRecord[],
  prediction: CyclePrediction,
): { status: DayStatus; dDay: number | null } {
  return {
    status: statusForDate(today, periods, prediction),
    dDay: prediction.nextPeriodStart ? diffDays(today, prediction.nextPeriodStart) : null,
  }
}

export function calcAverages(
  periods: PeriodRecord[],
  settings: CycleSettings,
): { cycleLen: number; periodLen: number } {
  const starts = periods.map((p) => p.start_date).sort()

  const intervals: number[] = []
  for (let i = 1; i < starts.length; i++) {
    intervals.push(diffDays(starts[i - 1], starts[i]))
  }
  const recent = intervals.slice(-MAX_INTERVALS)

  const cycleLen =
    recent.length > 0
      ? Math.round(recent.reduce((sum, n) => sum + n, 0) / recent.length)
      : settings.cycleLenOverride ?? DEFAULT_CYCLE_LEN

  const lengths = periods
    .filter((p) => p.end_date)
    .map((p) => diffDays(p.start_date, p.end_date!) + 1)
  const periodLen =
    lengths.length > 0
      ? Math.round(lengths.reduce((sum, n) => sum + n, 0) / lengths.length)
      : settings.periodLenOverride ?? DEFAULT_PERIOD_LEN

  return { cycleLen, periodLen }
}
