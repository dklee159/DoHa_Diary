import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, ApiError, clearToken, getToken, setToken, setUnauthorizedHandler } from './api'
import type { User } from './types'

const USER_CACHE_KEY = 'doha.user'

// 서버가 잠들어 있어도(Render free 콜드 스타트) 즉시 로그인 상태로 시작하기 위한 캐시
function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function cacheUser(user: User | null) {
  if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_CACHE_KEY)
}

interface AuthState {
  user: User | null
  loading: boolean
  login: (token: string, user: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (getToken() ? readCachedUser() : null))
  const [loading, setLoading] = useState(() => !!getToken() && !readCachedUser())

  useEffect(() => {
    setUnauthorizedHandler(() => {
      cacheUser(null)
      setUser(null)
    })
    if (!getToken()) {
      setLoading(false)
      return
    }

    // 캐시로 먼저 렌더한 뒤 백그라운드에서 최신화한다.
    // 서버가 잠들어 있으면(Render free 콜드 스타트) 깨어날 때까지 재시도한다.
    let cancelled = false
    async function loadMe(attempt: number) {
      try {
        const data = await api<{ user: User }>('/me')
        if (cancelled) return
        cacheUser(data.user)
        setUser(data.user)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        // 401(만료·무효)일 때만 세션을 버린다. 네트워크 오류/서버 기동 중에
        // 토큰을 지우면 서버가 잠들 때마다 강제 로그아웃되는 버그가 된다.
        if (err instanceof ApiError && err.status === 401) {
          clearToken()
          cacheUser(null)
          setUser(null)
          setLoading(false)
          return
        }
        if (attempt < 8 && getToken()) {
          setTimeout(() => loadMe(attempt + 1), Math.min(15_000, 2_000 * (attempt + 1)))
        } else {
          setLoading(false)
        }
      }
    }
    loadMe(0)
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback((token: string, nextUser: User) => {
    setToken(token)
    cacheUser(nextUser)
    setUser(nextUser)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    cacheUser(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const data = await api<{ user: User }>('/me')
    cacheUser(data.user)
    setUser(data.user)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
