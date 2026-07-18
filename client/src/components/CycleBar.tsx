import { diffDays, fmtMonthDay } from '../lib/date'
import type { Period, Prediction } from '../lib/types'

// 이번 주기를 왼쪽(마지막 시작일)→오른쪽(다음 예정일)으로 펼친 타임라인 바.
// 실제 날짜가 양 끝에 붙고 오늘 위치에 하트가 떠서 곡선보다 직관적으로 읽힌다.
const HEART_PATH =
  'M0,2.8 C-1,0.9 -3.6,0.2 -3.6,-1.6 C-3.6,-2.9 -2.5,-3.7 -1.6,-3.7 C-0.9,-3.7 -0.3,-3.3 0,-2.6 C0.3,-3.3 0.9,-3.7 1.6,-3.7 C2.5,-3.7 3.6,-2.9 3.6,-1.6 C3.6,0.2 1,0.9 0,2.8 Z'

export function CycleBar({
  periods,
  prediction,
  today,
}: {
  periods: Period[]
  prediction: Prediction
  today: string
}) {
  const starts = periods.map((p) => p.start_date).sort()
  const lastStart = starts.length > 0 ? starts[starts.length - 1] : null
  const nextStart = prediction.nextPeriodStart
  if (!lastStart || !nextStart) return null

  const total = diffDays(lastStart, nextStart)
  if (total <= 0) return null

  const clamp = (n: number) => Math.min(1, Math.max(0, n))
  const toT = (date: string) => clamp(diffDays(lastStart, date) / total)
  const pct = (t: number) => `${(t * 100).toFixed(1)}%`

  const lastPeriod = periods.find((p) => p.start_date === lastStart)
  const periodEndT = lastPeriod?.end_date
    ? toT(lastPeriod.end_date) + 1 / total
    : clamp(prediction.periodLen / total)

  const segments = [{ from: 0, to: clamp(periodEndT), color: 'var(--rose)' }]

  const fertile = prediction.fertileWindows[0]
  if (fertile && fertile.start < nextStart) {
    segments.push({
      from: toT(fertile.start),
      to: clamp(toT(fertile.end) + 1 / total),
      color: 'var(--violet)',
    })
  }
  const pms = prediction.pmsWindows[0]
  if (pms && pms.start < nextStart) {
    segments.push({
      from: toT(pms.start),
      to: clamp(toT(pms.end) + 1 / total),
      color: 'var(--peach)',
    })
  }

  const todayT = toT(today)

  return (
    <div
      className="cycle-bar"
      role="img"
      aria-label={`이번 주기: ${fmtMonthDay(lastStart)} 시작, 다음 예정 ${fmtMonthDay(nextStart)}`}
    >
      <div className="cycle-bar-track">
        {segments.map((seg, i) => (
          <span
            key={i}
            className="cycle-seg"
            style={{
              left: pct(seg.from),
              width: pct(seg.to - seg.from),
              background: seg.color,
              animationDelay: `${0.15 + i * 0.15}s`,
            }}
          />
        ))}
        {fertile && (
          <span className="cycle-ovu" style={{ left: pct(toT(fertile.ovulation) + 0.5 / total) }} />
        )}
        <span className="cycle-today" style={{ left: pct(todayT) }}>
          <span className="cycle-today-label">오늘</span>
          <svg width="19" height="18" viewBox="-4.8 -4.6 9.6 8.6" aria-hidden>
            <path
              d={HEART_PATH}
              fill="#fff"
              stroke="var(--rose-deep)"
              strokeWidth={1.1}
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <div className="cycle-bar-dates">
        <span>{fmtMonthDay(lastStart)} 시작</span>
        <span>{fmtMonthDay(nextStart)} 예정</span>
      </div>
    </div>
  )
}
