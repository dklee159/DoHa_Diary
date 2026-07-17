import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { User } from '../lib/types'

// 로고 리본 — 다이어리 표지에 묶인 리본 한 가닥
function Ribbon() {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden>
      <path
        d="M23 20c-4-7-14-8-16-3s5 10 16 10c11 0 18-5 16-10s-12-4-16 3Z"
        stroke="var(--rose)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="22" r="3.2" fill="var(--rose)" />
      <path
        d="M20 25 15 37M26 25l5 12"
        stroke="var(--rose)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/signup'
      const body =
        mode === 'login' ? { username, password } : { username, password, displayName }
      const data = await api<{ token: string; user: User }>(path, { method: 'POST', body })
      login(data.token, data.user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '문제가 발생했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page" style={{ paddingTop: '14dvh' }}>
      <header style={{ textAlign: 'center', marginBottom: 36 }}>
        <Ribbon />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, marginTop: 10 }}>
          도하 다이어리
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 6 }}>
          우리 둘이 함께 보는 몸과 마음 달력
        </p>
      </header>

      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="username">아이디</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </div>
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="displayName">이름 (연인에게 보여요)</label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={20}
              placeholder="예: 도하"
            />
          </div>
        )}

        <p className="form-error" role="alert">{error}</p>

        <button className="btn btn-rose" disabled={busy}>
          {mode === 'login' ? '로그인' : '가입하고 시작하기'}
        </button>
      </form>

      <button
        type="button"
        className="btn-danger-text"
        style={{ display: 'block', margin: '18px auto 0', color: 'var(--ink-soft)' }}
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setError('')
        }}
      >
        {mode === 'login' ? '처음이에요 · 회원가입' : '계정이 있어요 · 로그인'}
      </button>
    </div>
  )
}
