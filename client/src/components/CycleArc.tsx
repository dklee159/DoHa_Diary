import { diffDays } from '../lib/date'
import type { Period, Prediction } from '../lib/types'

// 시그니처 요소: 낮은 아치 위에 이번 주기를 펼쳐 그린다.
// 왼쪽 끝 = 마지막 생리 시작일, 오른쪽 끝 = 다음 생리 예정일.
// 생리(로즈) → 가임기(라벤더) → PMS(피치) 구간을 칠하고 오늘 위치에 점을 찍는다.

const CX = 150
const CY = 196
const R = 172
const START_DEG = 152
const END_DEG = 28

interface Segment {
  from: number // 0~1
  to: number
  color: string
  width: number
}

function polar(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180
  return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad) }
}

function tToDeg(t: number): number {
  return START_DEG - t * (START_DEG - END_DEG)
}

function arcPath(fromT: number, toT: number): string {
  const a = polar(tToDeg(fromT))
  const b = polar(tToDeg(toT))
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${R} ${R} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

export function CycleArc({
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

  const segments: Segment[] = []

  // 실제 생리 구간 (이번 주기 시작 구간)
  const lastPeriod = periods.find((p) => p.start_date === lastStart)
  const periodEnd = lastPeriod?.end_date ?? null
  const periodEndT = periodEnd
    ? toT(periodEnd) + 1 / total // 종료일 당일 포함
    : clamp((prediction.periodLen - 1) / total + 1 / total)
  segments.push({ from: 0, to: periodEndT, color: 'var(--rose)', width: 7 })

  // 이번 주기의 가임기 (다음 예정일 기준 첫 창)
  const fertile = prediction.fertileWindows[0]
  if (fertile && fertile.start < nextStart) {
    segments.push({
      from: toT(fertile.start),
      to: toT(fertile.end) + 1 / total,
      color: 'var(--violet)',
      width: 7,
    })
  }

  // PMS 구간
  const pms = prediction.pmsWindows[0]
  if (pms && pms.start < nextStart) {
    segments.push({
      from: toT(pms.start),
      to: toT(pms.end) + 1 / total,
      color: 'var(--peach)',
      width: 7,
    })
  }

  const todayT = toT(today)
  const todayPos = polar(tToDeg(todayT))
  const ovulation = fertile ? polar(tToDeg(toT(fertile.ovulation) + 0.5 / total)) : null

  return (
    <svg
      className="cycle-arc"
      viewBox="0 0 300 132"
      role="img"
      aria-label="이번 주기 진행 상황"
    >
      {/* 바탕 트랙 */}
      <path d={arcPath(0, 1)} fill="none" stroke="var(--line)" strokeWidth={3} strokeLinecap="round" />

      {segments.map((seg, i) => (
        <path
          key={i}
          className="arc-seg"
          d={arcPath(seg.from, clamp(seg.to))}
          fill="none"
          stroke={seg.color}
          strokeWidth={seg.width}
          strokeLinecap="round"
          pathLength={1}
          style={{ animationDelay: `${0.15 + i * 0.18}s` }}
        />
      ))}

      {/* 배란일 마커 */}
      {ovulation && (
        <circle cx={ovulation.x} cy={ovulation.y} r={3} fill="#fff" stroke="var(--violet)" strokeWidth={2} />
      )}

      {/* 양 끝 라벨 */}
      <circle {...polar(START_DEG)} r={3.4} fill="var(--rose)" />
      <circle {...polar(END_DEG)} r={3.4} fill="#fff" stroke="var(--rose)" strokeWidth={2} />

      {/* 오늘 점 */}
      <g className="arc-today">
        <circle cx={todayPos.x} cy={todayPos.y} r={7.5} fill="var(--ink)" opacity={0.12} />
        <circle cx={todayPos.x} cy={todayPos.y} r={4.5} fill="var(--ink)" />
      </g>
    </svg>
  )
}
