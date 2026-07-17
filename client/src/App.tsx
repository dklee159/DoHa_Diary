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
      <p style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-soft)' }}>
        도하 다이어리
      </p>
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
