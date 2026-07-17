import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { todayStr } from '../lib/date'

export default function Onboarding() {
  const [step, setStep] = useState<'role' | 'cycle'>('role')
  const [lastStart, setLastStart] = useState('')
  const [cycleLen, setCycleLen] = useState(28)
  const [periodLen, setPeriodLen] = useState(5)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { refreshUser } = useAuth()
  const navigate = useNavigate()

  async function finishAsPartner() {
    setBusy(true)
    setError('')
    try {
      await api('/me', { method: 'PATCH', body: { trackingEnabled: false, onboarded: true } })
      await refreshUser()
      navigate('/settings', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제가 발생했어요.')
      setBusy(false)
    }
  }

  async function finishAsTracker(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (lastStart) {
        await api('/periods', { method: 'POST', body: { start_date: lastStart } })
      }
      await api('/me', {
        method: 'PATCH',
        body: { cycleLenOverride: cycleLen, periodLenOverride: periodLen, onboarded: true },
      })
      await refreshUser()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제가 발생했어요.')
      setBusy(false)
    }
  }

  if (step === 'role') {
    return (
      <div className="page" style={{ paddingTop: '12dvh' }}>
        <h1 className="page-title">반가워요!</h1>
        <p className="page-sub">도하 다이어리를 어떻게 사용할까요?</p>

        <button
          className="card rise-in"
          style={{ width: '100%', textAlign: 'left', marginBottom: 12, borderColor: 'var(--rose-soft)' }}
          onClick={() => setStep('cycle')}
          disabled={busy}
        >
          <strong style={{ color: 'var(--rose-deep)' }}>내 주기를 기록할래요</strong>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
            생리·가임기 예측과 몸 상태 기록을 시작해요.
          </p>
        </button>

        <button
          className="card rise-in"
          style={{ width: '100%', textAlign: 'left', borderColor: 'var(--violet-soft)', animationDelay: '0.06s' }}
          onClick={finishAsPartner}
          disabled={busy}
        >
          <strong style={{ color: 'var(--violet)' }}>연인의 달력을 함께 보러 왔어요</strong>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
            초대 코드로 연결하면 연인의 오늘 상태와 일정이 보여요.
          </p>
        </button>

        <p className="form-error" role="alert">{error}</p>
      </div>
    )
  }

  return (
    <div className="page" style={{ paddingTop: '10dvh' }}>
      <h1 className="page-title">주기를 알려주세요</h1>
      <p className="page-sub">잘 몰라도 괜찮아요. 기록이 쌓이면 자동으로 보정돼요.</p>

      <form onSubmit={finishAsTracker}>
        <div className="field">
          <label htmlFor="lastStart">마지막 생리 시작일 (건너뛰어도 돼요)</label>
          <input
            id="lastStart"
            type="date"
            value={lastStart}
            max={todayStr()}
            onChange={(e) => setLastStart(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="cycleLen">평균 주기 (일)</label>
          <input
            id="cycleLen"
            type="number"
            min={21}
            max={60}
            value={cycleLen}
            onChange={(e) => setCycleLen(Number(e.target.value))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="periodLen">평균 생리 기간 (일)</label>
          <input
            id="periodLen"
            type="number"
            min={2}
            max={10}
            value={periodLen}
            onChange={(e) => setPeriodLen(Number(e.target.value))}
            required
          />
        </div>

        <p className="form-error" role="alert">{error}</p>

        <button className="btn btn-rose" disabled={busy}>
          시작하기
        </button>
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 12, textAlign: 'center' }}>
          예측은 참고용이며 피임 목적으로 사용할 수 없어요.
        </p>
      </form>
    </div>
  )
}
