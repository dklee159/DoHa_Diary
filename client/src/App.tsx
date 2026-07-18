import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { BottomNav } from './components/BottomNav'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import CalendarPage from './pages/CalendarPage'
import Stats from './pages/Stats'
import Settings from './pages/Settings'

function Splash() {
  return (
    <div className="page" style={{ display: 'grid', placeItems: 'center', minHeight: '80dvh' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>도하 다이어리</p>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginTop: 8 }}>
          잠든 서버를 깨우는 중이에요… 잠시만요
        </p>
      </div>
    </div>
  )
}

function Guard() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  if (!user.onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  if (user.onboarded && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

function TabLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Guard />}>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<TabLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
