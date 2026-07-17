import { describe, expect, test } from 'vitest'
import {
  addDays,
  diffDays,
  calcAverages,
  calcPredictions,
  statusForDate,
  todaySummary,
} from './cycle'

describe('날짜 유틸', () => {
  test('addDays: 월 경계를 넘어 더한다', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })

  test('addDays: 평년 2월 말을 처리한다', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  test('addDays: 윤년 2월 29일을 처리한다', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  test('addDays: 음수로 빼면 이전 달로 넘어간다', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  test('diffDays: 두 날짜 간 일수 차이 (둘째 - 첫째)', () => {
    expect(diffDays('2026-01-01', '2026-01-31')).toBe(30)
    expect(diffDays('2026-03-15', '2026-03-10')).toBe(-5)
    expect(diffDays('2026-07-17', '2026-07-17')).toBe(0)
  })
})

describe('평균 주기/생리 기간 계산', () => {
  test('기록이 없으면 기본값 28일 주기 / 5일 생리', () => {
    const avg = calcAverages([], {})
    expect(avg.cycleLen).toBe(28)
    expect(avg.periodLen).toBe(5)
  })

  test('기록이 없고 사용자 설정이 있으면 설정값 사용', () => {
    const avg = calcAverages([], { cycleLenOverride: 31, periodLenOverride: 6 })
    expect(avg.cycleLen).toBe(31)
    expect(avg.periodLen).toBe(6)
  })

  test('시작일 간격이 있으면 간격 평균이 설정값보다 우선', () => {
    const periods = [
      { start_date: '2026-01-01', end_date: '2026-01-05' },
      { start_date: '2026-01-31', end_date: '2026-02-04' },
      { start_date: '2026-03-02', end_date: null },
    ]
    const avg = calcAverages(periods, { cycleLenOverride: 40 })
    expect(avg.cycleLen).toBe(30)
  })

  test('간격 평균은 반올림한다', () => {
    const periods = [
      { start_date: '2026-01-01', end_date: null },
      { start_date: '2026-01-30', end_date: null },
      { start_date: '2026-02-27', end_date: null },
    ]
    expect(calcAverages(periods, {}).cycleLen).toBe(29)
  })

  test('최근 6개 간격만 사용한다', () => {
    const starts = [
      '2025-10-01', '2025-11-10', '2025-12-08', '2026-01-05',
      '2026-02-02', '2026-03-02', '2026-03-30', '2026-04-27',
    ]
    const periods = starts.map((s) => ({ start_date: s, end_date: null }))
    expect(calcAverages(periods, {}).cycleLen).toBe(28)
  })

  test('생리 기간은 종료일이 있는 기록만으로 평균 (시작·종료일 포함)', () => {
    const periods = [
      { start_date: '2026-01-01', end_date: '2026-01-04' },
      { start_date: '2026-01-29', end_date: '2026-02-03' },
      { start_date: '2026-02-26', end_date: null },
    ]
    expect(calcAverages(periods, {}).periodLen).toBe(5)
  })

  test('정렬되지 않은 입력도 처리한다', () => {
    const periods = [
      { start_date: '2026-03-02', end_date: null },
      { start_date: '2026-01-01', end_date: null },
      { start_date: '2026-01-31', end_date: null },
    ]
    expect(calcAverages(periods, {}).cycleLen).toBe(30)
  })
})

// 공통 픽스처: 마지막 시작 2026-07-01, 간격 28일, 생리 5일
const basePeriods = [
  { start_date: '2026-06-03', end_date: '2026-06-07' },
  { start_date: '2026-07-01', end_date: '2026-07-05' },
]

describe('예측 계산', () => {
  test('다음 생리 예정일 = 마지막 시작일 + 평균 주기', () => {
    const p = calcPredictions(basePeriods, {})
    expect(p.nextPeriodStart).toBe('2026-07-29')
  })

  test('향후 3주기의 예측 생리 기간을 투영한다', () => {
    const p = calcPredictions(basePeriods, {})
    expect(p.predictedPeriods).toEqual([
      { start: '2026-07-29', end: '2026-08-02' },
      { start: '2026-08-26', end: '2026-08-30' },
      { start: '2026-09-23', end: '2026-09-27' },
    ])
  })

  test('배란일 = 예측 시작일 - 14일, 가임기 = 배란일 -5일 ~ +1일', () => {
    const p = calcPredictions(basePeriods, {})
    expect(p.fertileWindows[0]).toEqual({
      ovulation: '2026-07-15',
      start: '2026-07-10',
      end: '2026-07-16',
    })
    expect(p.fertileWindows).toHaveLength(3)
  })

  test('PMS = 예측 시작일 -4일 ~ -1일', () => {
    const p = calcPredictions(basePeriods, {})
    expect(p.pmsWindows[0]).toEqual({ start: '2026-07-25', end: '2026-07-28' })
  })

  test('기록도 설정도 없으면 예측하지 않는다', () => {
    const p = calcPredictions([], {})
    expect(p.nextPeriodStart).toBeNull()
    expect(p.predictedPeriods).toEqual([])
    expect(p.fertileWindows).toEqual([])
    expect(p.pmsWindows).toEqual([])
  })

  test('기록 1개 + 사용자 설정 주기로도 예측한다', () => {
    const p = calcPredictions(
      [{ start_date: '2026-07-01', end_date: null }],
      { cycleLenOverride: 30 },
    )
    expect(p.nextPeriodStart).toBe('2026-07-31')
  })
})

describe('날짜별 상태 판정', () => {
  const pred = () => calcPredictions(basePeriods, {})

  test('실제 생리 기간은 period', () => {
    expect(statusForDate('2026-07-03', basePeriods, pred())).toBe('period')
    expect(statusForDate('2026-07-05', basePeriods, pred())).toBe('period')
  })

  test('배란일은 ovulation (가임기보다 우선)', () => {
    expect(statusForDate('2026-07-15', basePeriods, pred())).toBe('ovulation')
  })

  test('가임기는 fertile', () => {
    expect(statusForDate('2026-07-10', basePeriods, pred())).toBe('fertile')
    expect(statusForDate('2026-07-16', basePeriods, pred())).toBe('fertile')
  })

  test('PMS 기간은 pms', () => {
    expect(statusForDate('2026-07-25', basePeriods, pred())).toBe('pms')
    expect(statusForDate('2026-07-28', basePeriods, pred())).toBe('pms')
  })

  test('예측 생리 기간은 predicted_period', () => {
    expect(statusForDate('2026-07-29', basePeriods, pred())).toBe('predicted_period')
    expect(statusForDate('2026-08-02', basePeriods, pred())).toBe('predicted_period')
  })

  test('해당 없는 날은 none', () => {
    expect(statusForDate('2026-07-20', basePeriods, pred())).toBe('none')
  })

  test('종료일 없는 진행 중 생리는 평균 생리 기간만큼 period로 본다', () => {
    const ongoing = [{ start_date: '2026-07-01', end_date: null }]
    const p = calcPredictions(ongoing, { periodLenOverride: 5 })
    expect(statusForDate('2026-07-05', ongoing, p)).toBe('period')
    expect(statusForDate('2026-07-06', ongoing, p)).toBe('none')
  })
})

describe('오늘 요약', () => {
  const pred = () => calcPredictions(basePeriods, {})

  test('다음 생리까지 남은 일수(D-Day)를 계산한다', () => {
    const s = todaySummary('2026-07-17', basePeriods, pred())
    expect(s.dDay).toBe(12)
    expect(s.status).toBe('none')
  })

  test('예정일 당일은 D-0', () => {
    expect(todaySummary('2026-07-29', basePeriods, pred()).dDay).toBe(0)
  })

  test('예정일이 지나면 음수(지연 일수)', () => {
    expect(todaySummary('2026-08-01', basePeriods, pred()).dDay).toBe(-3)
  })

  test('예측이 없으면 dDay는 null', () => {
    const p = calcPredictions([], {})
    expect(todaySummary('2026-07-17', [], p).dDay).toBeNull()
  })
})
