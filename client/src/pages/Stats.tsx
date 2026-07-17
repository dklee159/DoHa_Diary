import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { diffDays, fmtMonthDay, todayStr } from '../lib/date'
import type { PredictionsResponse } from '../lib/types'
import './stats.css'

interface CyclePoint {
  startDate: string
  length: number // 이 주기의 길이 (다음 시작일까지)
}

// 단일 시리즈 라인 차트 — 데이터 색은 검증 통과한 rose-deep(#C95474),
// 텍스트/그리드는 잉크 토큰. 마지막 점만 직접 라벨, 나머지는 호버 툴팁.
function CycleTrendChart({ points, avg }: { points: CyclePoint[]; avg: number }) {
  const [hover, setHover] = useState<number | null>(null)

  const W = 320
  const H = 150
  const PAD = { top: 18, right: 34, bottom: 24, left: 30 }

  const values = points.map((p) => p.length)
  const yMin = Math.min(...values, avg) - 2
  const yMax = Math.max(...values, avg) + 2

  const x = (i: number) =>
    PAD.left + (points.length === 1 ? 0.5 : i / (points.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.length)}`).join(' ')

  const gridVals = [Math.ceil(yMin + 1), Math.round((yMin + yMax) / 2), Math.floor(yMax - 1)]
  const last = points.length - 1

  return (
    <div className="chart-card">
      <p className="chart-title">주기 길이 추이 (일)</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block' }}
        role="img"
        aria-label={`최근 ${points.length}번의 주기 길이 추이. 아래 표에서 자세히 볼 수 있어요.`}
      >
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--ink-soft)">
              {v}
            </text>
          </g>
        ))}

        {/* 평균선 */}
        <line
          x1={PAD.left} x2={W - PAD.right} y1={y(avg)} y2={y(avg)}
          stroke="var(--ink-soft)" strokeWidth={1} strokeDasharray="3 4"
        />
        <text x={W - PAD.right + 4} y={y(avg) + 3.5} fontSize={10} fill="var(--ink-soft)">
          평균
        </text>

        <path d={linePath} fill="none" stroke="#C95474" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={p.startDate}>
            <circle cx={x(i)} cy={y(p.length)} r={4} fill="#C95474" stroke="var(--paper)" strokeWidth={2} />
            {/* 넓은 히트 영역 */}
            <circle
              cx={x(i)} cy={y(p.length)} r={14} fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(hover === i ? null : i)}
            />
            {i === last && (
              <text x={x(i)} y={y(p.length) - 10} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ink)">
                {p.length}일
              </text>
            )}
          </g>
        ))}

        {/* x축 라벨: 처음/끝만 */}
        <text x={x(0)} y={H - 6} textAnchor="start" fontSize={10} fill="var(--ink-soft)">
          {fmtMonthDay(points[0].startDate)}
        </text>
        {points.length > 1 && (
          <text x={x(last)} y={H - 6} textAnchor="end" fontSize={10} fill="var(--ink-soft)">
            {fmtMonthDay(points[last].startDate)}
          </text>
        )}
      </svg>

      {hover !== null && (
        <div
          className="chart-tip"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: `${(y(points[hover].length) / H) * 100}%`,
          }}
        >
          {fmtMonthDay(points[hover].startDate)} 시작 · {points[hover].length}일
        </div>
      )}
    </div>
  )
}

export default function Stats() {
  const { user } = useAuth()
  const [data, setData] = useState<PredictionsResponse | null>(null)

  useEffect(() => {
    if (!user?.trackingEnabled) return
    api<PredictionsResponse>(`/predictions?today=${todayStr()}`).then(setData).catch(() => {})
  }, [user?.trackingEnabled])

  const sorted = useMemo(
    () => (data ? [...data.periods].sort((a, b) => (a.start_date < b.start_date ? -1 : 1)) : []),
    [data],
  )

  const cyclePoints: CyclePoint[] = useMemo(() => {
    const pts: CyclePoint[] = []
    for (let i = 1; i < sorted.length; i++) {
      pts.push({
        startDate: sorted[i - 1].start_date,
        length: diffDays(sorted[i - 1].start_date, sorted[i].start_date),
      })
    }
    return pts.slice(-12)
  }, [sorted])

  if (!user?.trackingEnabled) {
    return (
      <div className="page">
        <h1 className="page-title">통계</h1>
        <div className="card">
          <p className="empty-note">
            주기 기록 기능을 사용하고 있지 않아요.
            <br />
            <Link to="/settings" style={{ color: 'var(--rose-deep)', fontWeight: 500 }}>
              설정에서 켤 수 있어요 →
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">통계</h1>
      <p className="page-sub">기록이 쌓일수록 예측이 정확해져요.</p>

      <div className="stat-tiles">
        <div className="stat-tile">
          <p className="stat-label">평균 주기</p>
          <p className="stat-num">
            {data?.prediction.cycleLen ?? '—'}
            <small>일</small>
          </p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">평균 생리 기간</p>
          <p className="stat-num">
            {data?.prediction.periodLen ?? '—'}
            <small>일</small>
          </p>
        </div>
      </div>

      {cyclePoints.length >= 2 && data ? (
        <CycleTrendChart points={cyclePoints} avg={data.prediction.cycleLen} />
      ) : (
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="empty-note">주기가 두 번 이상 기록되면 추이 그래프가 보여요.</p>
        </div>
      )}

      <div className="chart-card">
        <p className="chart-title">최근 기록</p>
        {sorted.length === 0 ? (
          <p className="empty-note">아직 생리 기록이 없어요. 캘린더에서 남겨보세요.</p>
        ) : (
          <table className="cycle-table">
            <thead>
              <tr>
                <th>시작일</th>
                <th>기간</th>
                <th>주기</th>
              </tr>
            </thead>
            <tbody>
              {[...sorted].reverse().slice(0, 8).map((p, idx, arr) => {
                const originalIdx = sorted.length - 1 - idx
                const next = sorted[originalIdx + 1]
                const periodDays = p.end_date ? diffDays(p.start_date, p.end_date) + 1 : null
                const cycleDays = next ? diffDays(p.start_date, next.start_date) : null
                void arr
                return (
                  <tr key={p.start_date}>
                    <td>{fmtMonthDay(p.start_date)}</td>
                    <td className="num">{periodDays ? `${periodDays}일` : '기록 중'}</td>
                    <td className="num">{cycleDays ? `${cycleDays}일` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
