import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { fmtFull, todayStr } from '../lib/date'
import { STATUS_LABEL } from '../lib/cycleView'
import type {
  DailyLog,
  DayStatus,
  EventCategory,
  EventItem,
  Flow,
  Mood,
  Period,
} from '../lib/types'

const MOOD_OPTIONS: { value: Mood; label: string }[] = [
  { value: 'great', label: '최고' },
  { value: 'good', label: '좋음' },
  { value: 'soso', label: '보통' },
  { value: 'bad', label: '우울' },
  { value: 'awful', label: '힘듦' },
]

const SYMPTOM_OPTIONS = [
  '복통', '두통', '허리 통증', '가슴 통증', '여드름',
  '피로', '붓기', '식욕 폭발', '메스꺼움', '불면',
]

const FLOW_OPTIONS: { value: Flow; label: string }[] = [
  { value: 'light', label: '적음' },
  { value: 'medium', label: '보통' },
  { value: 'heavy', label: '많음' },
]

const CATEGORY_LABEL: Record<EventCategory, string> = {
  date: '데이트',
  anniversary: '기념일',
  trip: '여행',
  etc: '기타',
}

interface Props {
  date: string
  status: DayStatus
  periods: Period[]
  events: EventItem[]
  log: DailyLog | null
  canTrack: boolean
  hasCouple: boolean
  onClose: () => void
  onChanged: () => void
}

export function DaySheet({
  date, status, periods, events, log, canTrack, hasCouple, onClose, onChanged,
}: Props) {
  const today = todayStr()
  const [mood, setMood] = useState<Mood | null>(null)
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [flow, setFlow] = useState<Flow | null>(null)
  const [memo, setMemo] = useState('')
  const [evTitle, setEvTitle] = useState('')
  const [evCategory, setEvCategory] = useState<EventCategory>('date')
  const [evShared, setEvShared] = useState(hasCouple)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setMood(log?.mood ?? null)
    setSymptoms(log?.symptoms ?? [])
    setFlow(log?.flow ?? null)
    setMemo(log?.memo ?? '')
  }, [log, date])

  // 이 날짜가 포함된 실제 생리 기록 / 진행 중(종료 미입력) 기록
  const containing = periods.find(
    (p) => p.start_date <= date && date <= (p.end_date ?? p.start_date),
  )
  const ongoing = periods.find((p) => !p.end_date && p.start_date < date)

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제가 발생했어요.')
    } finally {
      setBusy(false)
    }
  }

  const startPeriod = () =>
    run(() => api('/periods', { method: 'POST', body: { start_date: date } }))

  const endPeriod = (p: Period) =>
    run(() =>
      api(`/periods/${p.id}`, {
        method: 'PUT',
        body: { start_date: p.start_date, end_date: date },
      }),
    )

  const deletePeriod = (p: Period) =>
    run(() => api(`/periods/${p.id}`, { method: 'DELETE' }))

  const addEvent = (e: FormEvent) => {
    e.preventDefault()
    if (!evTitle.trim()) return
    run(() =>
      api('/events', {
        method: 'POST',
        body: { date, title: evTitle.trim(), category: evCategory, isShared: evShared },
      }),
    ).then(() => setEvTitle(''))
  }

  const deleteEvent = (id: number) =>
    run(() => api(`/events/${id}`, { method: 'DELETE' }))

  const saveLog = () =>
    run(() =>
      api(`/logs/${date}`, { method: 'PUT', body: { mood, symptoms, flow, memo } }),
    ).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    })

  const statusLabel = STATUS_LABEL[status]

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <div className="sheet" role="dialog" aria-label={`${fmtFull(date)} 기록`}>
        <div className="sheet-handle" aria-hidden />
        <p className="sheet-date">{fmtFull(date)}</p>
        <p className={`sheet-status st-${status}`}>
          {statusLabel ? <>오늘 상태: <strong>{statusLabel}</strong></> : ' '}
        </p>

        {canTrack && (
          <div className="sheet-section">
            <h3>생리 기록</h3>
            <div className="sheet-actions">
              {containing ? (
                <>
                  {!containing.end_date && containing.start_date < date && date <= today && (
                    <button className="btn btn-rose" disabled={busy} onClick={() => endPeriod(containing)}>
                      이 날짜로 종료 기록
                    </button>
                  )}
                  <button className="btn btn-ghost" disabled={busy} onClick={() => deletePeriod(containing)}>
                    이 생리 기록 삭제
                  </button>
                </>
              ) : ongoing && date <= today ? (
                <button className="btn btn-rose" disabled={busy} onClick={() => endPeriod(ongoing)}>
                  이 날짜까지 생리했어요
                </button>
              ) : date <= today ? (
                <button className="btn btn-rose" disabled={busy} onClick={startPeriod}>
                  이 날부터 생리 시작
                </button>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                  미래 날짜에는 생리 기록을 남길 수 없어요.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="sheet-section">
          <h3>일정</h3>
          {events.map((ev) => (
            <div className="event-row" key={ev.id}>
              <span className={`event-cat ${ev.category}`} aria-hidden />
              <span>{ev.title}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                {CATEGORY_LABEL[ev.category]}
              </span>
              {ev.isShared && <span className="event-shared">함께</span>}
              {ev.mine && (
                <button className="event-del" disabled={busy} onClick={() => deleteEvent(ev.id)}>
                  삭제
                </button>
              )}
            </div>
          ))}
          <form className="event-form" onSubmit={addEvent}>
            <input
              type="text"
              placeholder="예: 저녁 데이트"
              value={evTitle}
              maxLength={50}
              onChange={(e) => setEvTitle(e.target.value)}
            />
            <select value={evCategory} onChange={(e) => setEvCategory(e.target.value as EventCategory)}>
              {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <button className="btn btn-rose" style={{ width: 'auto', padding: '10px 14px' }} disabled={busy || !evTitle.trim()}>
              추가
            </button>
          </form>
          {hasCouple && (
            <label className="share-toggle">
              <input type="checkbox" checked={evShared} onChange={(e) => setEvShared(e.target.checked)} />
              연인과 함께 보는 일정으로 등록
            </label>
          )}
        </div>

        {canTrack && (
          <>
            <div className="sheet-section">
              <h3>기분</h3>
              <div className="chips">
                {MOOD_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    className={`chip ${mood === m.value ? 'on' : ''}`}
                    onClick={() => setMood(mood === m.value ? null : m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet-section">
              <h3>증상</h3>
              <div className="chips">
                {SYMPTOM_OPTIONS.map((s) => (
                  <button
                    key={s}
                    className={`chip ${symptoms.includes(s) ? 'on-violet' : ''}`}
                    onClick={() =>
                      setSymptoms(
                        symptoms.includes(s)
                          ? symptoms.filter((x) => x !== s)
                          : [...symptoms, s],
                      )
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet-section">
              <h3>생리량</h3>
              <div className="chips">
                {FLOW_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    className={`chip ${flow === f.value ? 'on' : ''}`}
                    onClick={() => setFlow(flow === f.value ? null : f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet-section">
              <h3>메모 (나만 볼 수 있어요)</h3>
              <textarea
                value={memo}
                maxLength={2000}
                placeholder="오늘의 몸과 마음을 남겨보세요"
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>

            <button className="btn btn-rose" disabled={busy} onClick={saveLog}>
              {saved ? '저장했어요 ✓' : '기록 저장'}
            </button>
          </>
        )}

        <p className="form-error" role="alert">{error}</p>
      </div>
    </>
  )
}
