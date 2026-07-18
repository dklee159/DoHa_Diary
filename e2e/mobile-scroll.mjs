// 갤럭시(모바일 터치) 에뮬레이션으로 홈/캘린더 스크롤 동작 검증
import { chromium, devices } from 'playwright'

const BASE = 'http://localhost:3001'
const galaxy = devices['Galaxy S9+'] // Android Chrome UA, 터치, 320x658 뷰포트

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ ...galaxy })
const page = await ctx.newPage()

// 기존 스모크 계정으로 로그인 (기록 있어서 홈에 아치+일정 영역이 렌더됨)
await page.goto(`${BASE}/login`)
await page.fill('#username', 'smoketest')
await page.fill('#password', 'test1234')
await page.click('button:has-text("로그인")')
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 })
// smoketest는 온보딩 전 계정일 수 있음 → API로 온보딩 완료 처리 후 홈으로
await page.evaluate(async () => {
  await fetch('/api/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('doha.token')}`,
    },
    body: JSON.stringify({ onboarded: true, trackingEnabled: true }),
  })
})
await page.goto(`${BASE}/`)
await page.waitForSelector('.home-greeting', { timeout: 15000 })

async function probeScroll(label) {
  const metrics = await page.evaluate(() => {
    const root = document.getElementById('root')
    return {
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
      scrollTopBefore: root.scrollTop,
    }
  })
  // 실제 터치 스와이프 (아래로 스크롤 = 손가락을 위로)
  await page.touchscreen.tap(160, 300)
  const cx = 160
  await page.evaluate(() => window.scrollTo(0, 0))
  // Playwright touchscreen에는 swipe가 없어 CDP 제스처 사용
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.synthesizeScrollGesture', {
    x: cx, y: 400, xDistance: 0, yDistance: -350, speed: 800,
  })
  await page.waitForTimeout(400)
  const after = await page.evaluate(() => document.getElementById('root').scrollTop)
  const overflow = metrics.scrollHeight > metrics.clientHeight
  const scrolled = after > 5
  // 내용이 화면에 다 들어가면 스크롤할 것이 없으므로 통과
  const ok = !overflow || scrolled
  console.log(
    `${ok ? '✅' : '❌'} ${label} — 내용높이 ${metrics.scrollHeight} / 화면 ${metrics.clientHeight}${overflow ? `, 스와이프 후 scrollTop=${after}` : ' (한 화면에 모두 표시됨)'}`,
  )
  return ok
}

const homeOk = await probeScroll('홈 터치 스크롤')

await page.click('.bottom-nav a[href="/calendar"]')
await page.waitForSelector('.cal-grid')
const calOk = await probeScroll('캘린더 터치 스크롤')

await browser.close()
process.exit(homeOk && calOk ? 0 : 1)
