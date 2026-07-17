import { NavLink } from 'react-router-dom'

// 직접 그린 미니 스트로크 아이콘 — 이모지/아이콘팩 대신 이 앱만의 선
function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10.5V19h11v-8.5" />
      <path d="M12 19v-4" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="6" width="16" height="14" rx="3" />
      <path d="M4 10.5h16" />
      <path d="M8.5 4v3.5M15.5 4v3.5" />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconStats() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 17c2.2 0 2.6-6 5-6s2.6 8 5 8 2.8-11 6-11" />
      <path d="M4 20h16" />
    </svg>
  )
}

function IconFlower() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 9.6V5.5M14.1 10.8l3.5-2M14.1 13.2l3.5 2M12 14.4v4.1M9.9 13.2l-3.5 2M9.9 10.8l-3.5-2" />
    </svg>
  )
}

const TABS = [
  { to: '/', label: '홈', icon: <IconHome /> },
  { to: '/calendar', label: '캘린더', icon: <IconCalendar /> },
  { to: '/stats', label: '통계', icon: <IconStats /> },
  { to: '/settings', label: '설정', icon: <IconFlower /> },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="주 메뉴">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
