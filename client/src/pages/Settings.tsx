import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { todayStr } from '../lib/date'
import type { PartnerResponse, User } from '../lib/types'
import './settings.css'

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <span className="switch">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="track" aria-hidden />
    </span>
  )
}

export default function Settings() {
  const { user, logout, refreshUser } = useAuth()
  const [partner, setPartner] = useState<PartnerResponse | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  // 입력 중 빈 칸을 허용하기 위해 문자열로 들고, 저장 시 숫자로 검증한다
  const [cycleLen, setCycleLen] = useState(String(user?.cycleLenOverride ?? 28))
  const [periodLen, setPeriodLen] = useState(String(user?.periodLenOverride ?? 5))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const loadPartner = useCallback(() => {
    api<PartnerResponse>(`/partner?today=${todayStr()}`).then(setPartner).catch(() => {})
  }, [])

  useEffect(loadPartner, [loadPartner])

  async function run(fn: () => Promise<unknown>, doneMsg = '') {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
      loadPartner()
      await refreshUser()
      if (doneMsg) {
        setNotice(doneMsg)
        setTimeout(() => setNotice(''), 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제가 발생했어요.')
    } finally {
      setBusy(false)
    }
  }

  const patchMe = (body: Partial<Record<keyof User, unknown>>, msg = '') =>
    run(() => api('/me', { method: 'PATCH', body }), msg)

  const createInvite = () => run(() => api('/couple/invite', { method: 'POST' }))

  const joinCouple = (e: FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    run(() => api('/couple/join', { method: 'POST', body: { code: joinCode } }), '연결됐어요!')
      .then(() => setJoinCode(''))
  }

  const disconnect = () => {
    if (!window.confirm('커플 연결을 해제할까요? 공유 일정은 각자의 개인 일정으로 남아요.')) return
    run(() => api('/couple', { method: 'DELETE' }), '연결을 해제했어요.')
  }

  if (!user) return null

  return (
    <div className="page">
      <h1 className="page-title">설정</h1>
      <p className="page-sub">{user.username}</p>

      {/* 커플 연결 */}
      <section className="settings-section card">
        <h2>커플 연결</h2>
        {partner?.connected ? (
          <>
            <div className="couple-connected">
              <span className="partner-heart" aria-hidden>♥</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14 }}>
                  {partner.partner?.displayName}님과 연결되어 있어요
                </p>
                <p className="setting-desc">서로의 공유 일정을 함께 볼 수 있어요.</p>
              </div>
            </div>
            <button className="btn-danger-text" onClick={disconnect} disabled={busy}>
              연결 해제
            </button>
          </>
        ) : partner?.pending ? (
          <>
            <p className="setting-desc">연인에게 이 코드를 알려주세요. 상대가 입력하면 연결돼요.</p>
            <p className="invite-code">{partner.inviteCode}</p>
            <button className="btn-danger-text" onClick={disconnect} disabled={busy}>
              초대 취소
            </button>
          </>
        ) : (
          <>
            <p className="setting-desc" style={{ marginBottom: 10 }}>
              연인의 초대 코드가 있다면 입력해 주세요.
            </p>
            <form className="inline-form" onSubmit={joinCouple}>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="예: ABC234"
                maxLength={6}
                aria-label="초대 코드"
              />
              <button className="btn btn-rose" disabled={busy || !joinCode.trim()}>
                연결
              </button>
            </form>
            <hr className="stitch" style={{ margin: '14px 0' }} />
            <p className="setting-desc" style={{ marginBottom: 10 }}>
              아직 코드가 없다면 내가 먼저 만들 수 있어요.
            </p>
            <button className="btn btn-ghost" onClick={createInvite} disabled={busy}>
              초대 코드 만들기
            </button>
          </>
        )}
      </section>

      {/* 공유/추적 설정 */}
      <section className="settings-section card">
        <h2>공유와 기록</h2>
        <div className="setting-row">
          <div>
            <p className="setting-label">연인에게 내 주기 보여주기</p>
            <p className="setting-desc">끄면 연인에게 내 생리·가임기 정보가 보이지 않아요.</p>
          </div>
          <Switch
            checked={user.shareCycle}
            label="연인에게 내 주기 보여주기"
            onChange={(v) => patchMe({ shareCycle: v })}
          />
        </div>
        <div className="setting-row">
          <div>
            <p className="setting-label">내 주기 기록 사용</p>
            <p className="setting-desc">연인의 달력만 볼 거라면 꺼두세요.</p>
          </div>
          <Switch
            checked={user.trackingEnabled}
            label="내 주기 기록 사용"
            onChange={(v) => patchMe({ trackingEnabled: v })}
          />
        </div>
        <p className="setting-desc" style={{ marginTop: 8 }}>
          증상·기분·메모는 어떤 경우에도 나만 볼 수 있어요.
        </p>
      </section>

      {/* 주기 기본값 */}
      {user.trackingEnabled && (
        <section className="settings-section card">
          <h2>주기 기본값</h2>
          <p className="setting-desc" style={{ marginBottom: 10 }}>
            기록이 2회 이상 쌓이면 자동 계산값이 우선돼요.
          </p>
          <div className="setting-row">
            <p className="setting-label">평균 주기</p>
            <div className="num-inline">
              <input
                type="number" inputMode="numeric" min={21} max={60} value={cycleLen}
                onChange={(e) => setCycleLen(e.target.value)}
                aria-label="평균 주기(일)"
              />
              <span className="setting-desc">일</span>
            </div>
          </div>
          <div className="setting-row">
            <p className="setting-label">평균 생리 기간</p>
            <div className="num-inline">
              <input
                type="number" inputMode="numeric" min={2} max={10} value={periodLen}
                onChange={(e) => setPeriodLen(e.target.value)}
                aria-label="평균 생리 기간(일)"
              />
              <span className="setting-desc">일</span>
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ marginTop: 10 }}
            disabled={busy}
            onClick={() => {
              const cycle = Number(cycleLen)
              const period = Number(periodLen)
              if (!Number.isInteger(cycle) || cycle < 21 || cycle > 60) {
                setError('평균 주기는 21~60일 사이 숫자로 입력해 주세요.')
                return
              }
              if (!Number.isInteger(period) || period < 2 || period > 10) {
                setError('평균 생리 기간은 2~10일 사이 숫자로 입력해 주세요.')
                return
              }
              patchMe({ cycleLenOverride: cycle, periodLenOverride: period }, '저장했어요.')
            }}
          >
            기본값 저장
          </button>
        </section>
      )}

      {/* 계정 */}
      <section className="settings-section card">
        <h2>계정</h2>
        <div className="setting-row">
          <p className="setting-label">이름</p>
          <div className="num-inline">
            <input
              style={{ width: 120, textAlign: 'left' }}
              value={displayName}
              maxLength={20}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-label="이름"
            />
            <button
              className="btn btn-ghost"
              style={{ width: 'auto', padding: '9px 12px', fontSize: 13 }}
              disabled={busy || !displayName.trim() || displayName === user.displayName}
              onClick={() => patchMe({ displayName }, '저장했어요.')}
            >
              변경
            </button>
          </div>
        </div>
        <button className="btn-danger-text" onClick={logout}>
          로그아웃
        </button>
      </section>

      <p className="form-error" role="alert">{error}</p>
      {notice && (
        <p style={{ color: 'var(--violet)', fontSize: 13, textAlign: 'center' }}>{notice}</p>
      )}

      <p className="disclaimer">
        도하 다이어리의 예측은 참고용이며 피임·의학적 판단의 근거가 될 수 없어요.
      </p>
    </div>
  )
}
