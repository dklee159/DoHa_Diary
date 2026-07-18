import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { calendarCells, todayStr } from '../lib/date'
import { statusForDate } from '../lib/cycleView'
import { HOLIDAYS } from '../lib/holidays'
import { DaySheet } from '../components/DaySheet'
import type {
  DailyLog,
  DayStatus,
  EventItem,
  PartnerResponse,
  PredictionsResponse,
} from '../lib/types'
import './calendar.css'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

// 밴드 그룹: 연속 구간을 알약으로 이을 때 같은 그룹끼리만 잇는다
function bandGroup(status: DayStatus): 'period' | 'predicted' | 'fertile' | null {
  if (status === 'period') return 'period'
  if (status === 'predicted_period') return 'predicted'
  if (status === 'fertile' || status === 'ovulation') return 'fertile'
  return null
}

export default function CalendarPage() {
  const { user } = useAuth()
  const today = todayStr()
  const [year, setYear] = useState(Number(today.slice(0, 4)))
  const [month, setMonth] = useState(Number(today.slice(5, 7)))
  const [mine, setMine] = useState<PredictionsResponse | null>(null)
  const [partner, setPartner] = useState<PartnerResponse | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const cells = useMemo(() => calendarCells(year, month), [year, month])
  const rangeFrom = cells[0].date
  const rangeTo = cells[cells.length - 1].date

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (user?.trackingEnabled) {
      api<PredictionsResponse>(`/predictions?today=${today}`).then(setMine).catch(() => {})
    }
    api<PartnerResponse>(`/partner?today=${today}`).then(setPartner).catch(() => {})
  }, [user?.trackingEnabled, today, version])

  useEffect(() => {
    api<{ events: EventItem[] }>(`/events?from=${rangeFrom}&to=${rangeTo}`)
      .then((d) => setEvents(d.events))
      .catch(() => {})
    api<{ logs: DailyLog[] }>(`/logs?from=${rangeFrom}&to=${rangeTo}`)
      .then((d) => setLogs(d.logs))
      .catch(() => {})
  }, [rangeFrom, rangeTo, version])

  // 내 주기 우선, 추적 안 하면 파트너 주기를 표시
  const cycleData = user?.trackingEnabled
    ? mine
    : partner?.connected && partner.cycle
      ? partner.cycle
      : null

  const statusOf = useCallback(
    (date: string): DayStatus =>
      cycleData ? statusForDate(date, cycleData.periods, cycleData.prediction) : 'none',
    [cycleData],
  )

  function moveMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m)
    setYear(y)
  }

  const eventDates = useMemo(() => new Set(events.map((e) => e.date)), [events])
  const logDates = useMemo(
    () =>
      new Set(
        logs
          .filter((l) => l.mood || l.symptoms.length > 0 || l.flow || l.memo)
          .map((l) => l.date),
      ),
    [logs],
  )

  const cycleOwnerNote =
    !user?.trackingEnabled && cycleData && partner?.partner
      ? `${partner.partner.displayName}님의 주기가 표시되고 있어요.`
      : null

  return (
    <div className="page">
      <div className="cal-head">
        <h1 className="cal-title">
          <span className="cal-year">{year}년</span>
          {month}월
        </h1>
        <div className="cal-nav">
          <button onClick={() => moveMonth(-1)} aria-label="이전 달">←</button>
          <button onClick={() => moveMonth(1)} aria-label="다음 달">→</button>
        </div>
      </div>

      <div className="cal-legend" aria-hidden>
        <span><i className="legend-chip" style={{ background: 'var(--rose-soft)' }} />생리</span>
        <span><i className="legend-chip" style={{ background: 'var(--rose-soft)', opacity: 0.45 }} />예정</span>
        <span><i className="legend-chip" style={{ background: 'var(--violet-soft)' }} />가임기</span>
        <span><i className="legend-chip" style={{ background: 'var(--violet)' }} />배란일</span>
        <span><i className="legend-chip" style={{ background: 'var(--peach)', width: 8, borderRadius: 99 }} />일정</span>
      </div>

      <div className="cal-grid" role="grid">
        {DOW.map((d, i) => (
          <div key={d} className={`cal-dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>
            {d}
          </div>
        ))}
        {cells.map((cell, idx) => {
          const status = statusOf(cell.date)
          const group = bandGroup(status)
          const dow = idx % 7
          // 주 경계·월 경계(비활성 셀)에서는 밴드를 알약으로 마감한다
          const prevCell = dow === 0 ? null : cells[idx - 1]
          const nextCell = dow === 6 ? null : cells[idx + 1]
          const prevGroup =
            prevCell?.inMonth ? bandGroup(statusOf(prevCell.date)) : null
          const nextGroup =
            nextCell?.inMonth ? bandGroup(statusOf(nextCell.date)) : null
          const bandStart = group !== null && prevGroup !== group
          const bandEnd = group !== null && nextGroup !== group

          const classes = [
            'cal-cell',
            status === 'period' ? 'is-period' : '',
            status === 'ovulation' ? 'is-ovulation' : '',
            cell.date === today ? 'is-today' : '',
            HOLIDAYS[cell.date] ? 'is-holiday' : '',
            dow === 0 ? 'dow-sun' : dow === 6 ? 'dow-sat' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={cell.date}
              className={classes}
              disabled={!cell.inMonth}
              onClick={() => setSelected(cell.date)}
              aria-label={cell.date}
            >
              {group && cell.inMonth && (
                <span
                  className={`cal-band b-${group} ${bandStart ? 'start' : ''} ${bandEnd ? 'end' : ''}`}
                  aria-hidden
                />
              )}
              <span className="cal-daynum">{Number(cell.date.slice(8))}</span>
              <span className="cal-dots" aria-hidden>
                {eventDates.has(cell.date) && <i className="dot-event" />}
                {logDates.has(cell.date) && <i className="dot-log" />}
              </span>
            </button>
          )
        })}
      </div>

      {cycleOwnerNote && (
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 10, textAlign: 'center' }}>
          {cycleOwnerNote}
        </p>
      )}

      <p className="disclaimer">예측은 기록 기반 참고용이며 피임·의학적 판단에 사용할 수 없어요.</p>

      {selected && (
        <DaySheet
          date={selected}
          holidayName={HOLIDAYS[selected] ?? null}
          status={statusOf(selected)}
          periods={user?.trackingEnabled ? (mine?.periods ?? []) : []}
          events={events.filter((e) => e.date === selected)}
          log={logs.find((l) => l.date === selected) ?? null}
          canTrack={!!user?.trackingEnabled}
          hasCouple={!!partner?.connected}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </div>
  )
}
