import { addDays } from './date'
import type { DayStatus, Period, Prediction } from './types'

// 서버 cycle.ts의 statusForDate와 같은 우선순위 규칙.
// 캘린더는 월 단위로 그리므로 클라이언트에서 즉시 계산한다.
export function statusForDate(
  date: string,
  periods: Period[],
  prediction: Prediction,
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

export const STATUS_LABEL: Record<DayStatus, string> = {
  period: '마법의 날',
  ovulation: '배란 예정일',
  fertile: '가임기',
  pms: 'PMS 기간',
  predicted_period: '생리 예정',
  none: '',
}

// "~예요/이에요" 조사를 받침에 맞게 붙인 문장 조각
export function statusSentence(status: DayStatus): string {
  const label = STATUS_LABEL[status]
  if (!label) return ''
  const code = label.charCodeAt(label.length - 1)
  const hasBatchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0
  return `${label}${hasBatchim ? '이에요' : '예요'}`
}
