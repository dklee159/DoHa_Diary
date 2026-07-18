import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { addDays, diffDays, fmtFull, fmtMonthDay, todayStr } from '../lib/date'
import { STATUS_LABEL } from '../lib/cycleView'
import { CycleArc } from '../components/CycleArc'
import type {
  EventItem,
  PartnerResponse,
  PredictionsResponse,
  TodaySummary,
} from '../lib/types'
import './home.css'

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 20.3 4.9 13a4.6 4.6 0 0 1 0-6.6 4.5 4.5 0 0 1 6.4 0l.7.7.7-.7a4.5 4.5 0 0 1 6.4 0 4.6 4.6 0 0 1 0 6.6L12 20.3Z" />
    </svg>
  )
}

function statusLine(summary: TodaySummary, periodDay: number | null): {
  big: string
  em: boolean
  sub: string
} {
  const { status, dDay } = summary
  if (status === 'period') {
    return {
      big: periodDay ? `${periodDay}일차` : '생리 중',
      em: true,
      sub: '오늘은 생리 중이에요. 몸을 따뜻하게 해주세요.',
    }
  }
  if (dDay === null) {
    return { big: '기록 전', em: false, sub: '첫 생리 기록을 남기면 예측이 시작돼요.' }
  }
  if (dDay < 0) {
    return {
      big: `D+${-dDay}`,
      em: true,
      sub: '예정일이 지났어요. 시작했다면 캘린더에 기록해 주세요.',
    }
  }
  const label = STATUS_LABEL[status]
  return {
    big: `D-${dDay}`,
    em: false,
    sub: label ? `다음 생리까지 ${dDay}일 · 오늘은 ${label}예요.` : `다음 생리까지 ${dDay}일 남았어요.`,
  }
}

export default function Home() {
  const { user } = useAuth()
  const [mine, setMine] = useState<PredictionsResponse | null>(null)
  const [partner, setPartner] = useState<PartnerResponse | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const today = todayStr()

  useEffect(() => {
    if (user?.trackingEnabled) {
      api<PredictionsResponse>(`/predictions?today=${today}`).then(setMine).catch(() => {})
    }
    api<PartnerResponse>(`/partner?today=${today}`).then(setPartner).catch(() => {})
    api<{ events: EventItem[] }>(`/events?from=${today}&to=${addDays(today, 30)}`)
      .then((d) => setEvents(d.events))
      .catch(() => {})
  }, [user?.trackingEnabled, today])

  // 생리 중이면 며칠차인지
  let periodDay: number | null = null
  if (mine?.today.status === 'period') {
    const current = mine.periods
      .filter((p) => p.start_date <= today)
      .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0]
    if (current) periodDay = diffDays(current.start_date, today) + 1
  }

  const partnerCycle = partner?.connected && partner.cycle ? partner.cycle : null

  // 내가 추적하지 않는 경우: 연인의 주기가 히어로가 된다
  const heroData = user?.trackingEnabled
    ? mine
    : partnerCycle
      ? { periods: partnerCycle.periods, prediction: partnerCycle.prediction, today: partnerCycle.today }
      : null
  const heroOwner = user?.trackingEnabled
    ? '나의 이번 주기'
    : partner?.partner
      ? `${partner.partner.displayName}님의 이번 주기`
      : null

  const line = heroData ? statusLine(heroData.today, user?.trackingEnabled ? periodDay : null) : null

  return (
    <div className="page">
      <p className="home-date">{fmtFull(today)}</p>
      <h1 className="home-greeting">
        {user?.displayName}님, 안녕하세요{' '}
        <span style={{ color: 'var(--rose)' }}>✿</span>
      </h1>

      {heroData && line ? (
        <section className="hero rise-in" aria-label="오늘 상태">
          {heroOwner && <p className="hero-owner">{heroOwner}</p>}
          <CycleArc periods={heroData.periods} prediction={heroData.prediction} today={today} />
          <p className="arc-legend" aria-hidden>
            <span><i style={{ background: 'var(--rose)' }} />생리</span>
            <span><i style={{ background: 'var(--violet)' }} />가임기</span>
            <span><i style={{ background: 'var(--peach)' }} />PMS</span>
            <span>
              <i style={{ width: 9, height: 9, background: '#fff', border: '2px solid var(--rose-deep)' }} />
              오늘
            </span>
          </p>
          <p className="dday">{line.em ? <em>{line.big}</em> : line.big}</p>
          <p className="hero-status">{line.sub}</p>
          {heroData.prediction.nextPeriodStart && (
            <p className="hero-hint">
              다음 생리 예정 {fmtMonthDay(heroData.prediction.nextPeriodStart)} · 배란 예정{' '}
              {heroData.prediction.fertileWindows[0]
                ? fmtMonthDay(heroData.prediction.fertileWindows[0].ovulation)
                : '—'}
            </p>
          )}
        </section>
      ) : (
        <section className="hero rise-in">
          <p className="empty-note">
            {user?.trackingEnabled
              ? '아직 기록이 없어요. 캘린더에서 마지막 생리 시작일을 남겨보세요.'
              : '아직 연인과 연결되지 않았어요. 설정에서 초대 코드로 연결해 보세요.'}
          </p>
          <Link
            className="btn btn-rose"
            to={user?.trackingEnabled ? '/calendar' : '/settings'}
            style={{ maxWidth: 220, margin: '0 auto' }}
          >
            {user?.trackingEnabled ? '캘린더로 가기' : '설정으로 가기'}
          </Link>
        </section>
      )}

      {/* 내가 추적 중일 때 연인 카드 */}
      {user?.trackingEnabled && partner?.connected && (
        <div className="card partner-card rise-in" style={{ animationDelay: '0.1s' }}>
          <span className="partner-heart">
            <HeartIcon />
          </span>
          <div>
            <p className="partner-name">{partner.partner?.displayName}</p>
            <p className="partner-status">
              {partnerCycle
                ? partnerCycle.today.status !== 'none'
                  ? `오늘은 ${STATUS_LABEL[partnerCycle.today.status]}예요.`
                  : partnerCycle.today.dDay !== null && partnerCycle.today.dDay >= 0
                    ? `다음 생리까지 D-${partnerCycle.today.dDay}`
                    : '함께 지켜봐 주세요.'
                : '주기 공유가 꺼져 있어요.'}
            </p>
          </div>
        </div>
      )}

      <h2 className="section-title">다가오는 일정</h2>
      <div className="card">
        {events.length === 0 ? (
          <p className="empty-note">
            앞으로 30일간 일정이 없어요.
            <br />
            <Link to="/calendar" style={{ color: 'var(--rose-deep)', fontWeight: 500 }}>
              캘린더에서 일정을 추가해 보세요 →
            </Link>
          </p>
        ) : (
          events.slice(0, 6).map((ev) => (
            <div className="event-row" key={ev.id}>
              <span className="event-date">{fmtMonthDay(ev.date)}</span>
              <span className={`event-cat ${ev.category}`} aria-hidden />
              <span>{ev.title}</span>
              {ev.isShared && <span className="event-shared">함께</span>}
            </div>
          ))
        )}
      </div>

      <p className="disclaimer">예측은 기록 기반 참고용이며 피임·의학적 판단에 사용할 수 없어요.</p>
    </div>
  )
}
