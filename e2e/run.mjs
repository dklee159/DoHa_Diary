// 도하 다이어리 E2E — 두 계정 커플 연결 시나리오 (Playwright + 시스템 Chrome)
// 실행: node e2e/run.mjs  (서버가 http://localhost:3001 에서 dist를 서빙 중이어야 함)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3001'
const SHOTS = 'e2e/shots'
mkdirSync(SHOTS, { recursive: true })

const suffix = Date.now().toString(36).slice(-5)

// UI는 기기(로컬) 날짜를 쓰므로 D-Day 기대값도 실행 시점 기준으로 계산한다.
// (마지막 생리 7/1 + 주기 28일 → 다음 예정일 2026-07-29 고정)
function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function dayDiff(a, b) {
  const p = (s) => s.split('-').map(Number)
  const [ay, am, ad] = p(a)
  const [by, bm, bd] = p(b)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 864e5)
}
const EXPECTED_DDAY = `D-${dayDiff(localToday(), '2026-07-29')}`
const A = { username: `jihye_${suffix}`, password: 'test1234', name: '지혜' }
const B = { username: `doha_${suffix}`, password: 'test1234', name: '도하' }

const results = []
function check(label, ok, detail = '') {
  results.push({ label, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const viewport = { width: 390, height: 844 }

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

async function signup(page, acct) {
  await page.goto(`${BASE}/login`)
  await page.click('text=처음이에요 · 회원가입')
  await page.fill('#username', acct.username)
  await page.fill('#password', acct.password)
  await page.fill('#displayName', acct.name)
  await page.click('button:has-text("가입하고 시작하기")')
  await page.waitForURL('**/onboarding')
}

// API 헬퍼 — 페이지의 토큰으로 직접 호출 (프로브용)
async function apiCall(page, path, method = 'GET', body) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const res = await fetch(`/api${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('doha.token')}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { path, method, body },
  )
}

try {
  // ── ① A(지혜) 가입 → 온보딩 → 홈 D-Day ──────────────────
  const ctxA = await browser.newContext({ viewport })
  const a = await ctxA.newPage()
  await signup(a, A)
  await a.click('text=내 주기를 기록할래요')

  // 🔍 숫자 입력을 모두 지웠을 때 '0'이 되살아나지 않아야 한다 (controlled input 회귀)
  await a.fill('#cycleLen', '')
  const emptyVal = await a.inputValue('#cycleLen')
  check('🔍 주기 입력 비우면 빈 칸 유지 (0 안 생김)', emptyVal === '', `값: "${emptyVal}"`)
  await a.fill('#cycleLen', '28')

  await a.fill('#lastStart', '2026-07-01')
  await a.click('button:has-text("시작하기")')
  await a.waitForURL(`${BASE}/`)
  await a.waitForSelector('.dday')
  const dday = (await a.textContent('.dday'))?.trim()
  check('① A 홈 D-Day 표시', dday === EXPECTED_DDAY, `표시값: ${dday} (기대 ${EXPECTED_DDAY}, 7/29 예정)`)
  const hint = await a.textContent('.hero-hint')
  check(
    '① A 홈 예측 요약 (다음 생리 7/29·배란 7/15)',
    !!hint && hint.includes('7월 29일') && hint.includes('7월 15일'),
    hint?.trim(),
  )
  await a.waitForTimeout(1400) // 아치 드로잉 애니메이션 완료 후 촬영
  await shot(a, '01-A-home')

  // 🔍 새로고침해도 로그인이 유지되어야 한다 (자동 로그인)
  await a.reload()
  await a.waitForSelector('.home-greeting')
  check('🔍 새로고침 후 로그인 유지', !a.url().includes('/login'))

  // ── ② A 캘린더: 생리/가임기/배란/예정 렌더 ────────────────
  await a.click('.bottom-nav a[href="/calendar"]')
  await a.waitForSelector('.cal-band') // 예측 데이터 렌더까지 대기
  const bands = await a.evaluate(() => {
    const q = (sel) => document.querySelectorAll(sel).length
    return {
      period: q('.cal-band.b-period'),
      fertile: q('.cal-band.b-fertile'),
      predicted: q('.cal-band.b-predicted'),
      ovulation: q('.cal-cell.is-ovulation'),
    }
  })
  // 7월: 실제 생리 7/1~7/5(5칸), 가임기 7/10~16(7칸), 예정 7/29~31(월내 3칸)
  check(
    '② A 캘린더 밴드 렌더',
    bands.period === 5 && bands.fertile === 7 && bands.predicted === 3 && bands.ovulation === 1,
    JSON.stringify(bands),
  )
  await shot(a, '02-A-calendar')

  // 🔍 한국 공휴일 표시: 8월로 이동해 광복절(8/15) 확인
  await a.click('button[aria-label="다음 달"]')
  await a.waitForSelector('button[aria-label="2026-08-15"]')
  const holidayCls = await a.getAttribute('button[aria-label="2026-08-15"]', 'class')
  await a.click('button[aria-label="2026-08-15"]')
  await a.waitForSelector('.sheet')
  const sheetHead = (await a.textContent('.sheet-date'))?.trim()
  check(
    '🔍 공휴일 표시 (8/15 광복절 빨간날 + 시트 라벨)',
    !!holidayCls?.includes('is-holiday') && !!sheetHead?.includes('광복절'),
    sheetHead,
  )
  await a.mouse.click(20, 60)
  await a.click('button[aria-label="이전 달"]')
  await a.waitForSelector('button[aria-label="2026-07-10"]')

  // ── ② A 기록: 7/10 증상/기분/비밀 메모 저장 ───────────────
  await a.click('button[aria-label="2026-07-10"]')
  await a.waitForSelector('.sheet')
  await a.click('.chip:has-text("좋음")')
  await a.click('.chip:has-text("복통")')
  await a.fill('.sheet textarea', '비밀 메모: 오늘 좀 예민했음')
  await a.click('button:has-text("기록 저장")')
  await a.waitForSelector('button:has-text("저장했어요")')
  check('② A 일일 기록 저장', true)
  await shot(a, '03-A-daysheet')
  await a.mouse.click(20, 60) // backdrop 클릭으로 시트 닫기

  // 생리 시작 기록 → 예측 갱신 확인 (7/18 시작 기록 후 다음 예정일 8/15)
  const before = await apiCall(a, '/predictions?today=2026-07-18')
  await a.click('button[aria-label="2026-07-18"]')
  await a.waitForSelector('.sheet')
  await a.click('button:has-text("이 날부터 생리 시작")')
  await a.waitForTimeout(600)
  const after = await apiCall(a, '/predictions?today=2026-07-18')
  check(
    '② 생리 기록 시 예측 갱신',
    before.json.prediction.nextPeriodStart === '2026-07-29' &&
      after.json.prediction.nextPeriodStart === '2026-08-04',
    `${before.json.prediction.nextPeriodStart} → ${after.json.prediction.nextPeriodStart} (7/1→7/18 간격 17일 평균 반영)`,
  )
  // 방금 기록 삭제해 원상복구 (시트가 열려 있음 → 삭제 버튼)
  await a.click('button:has-text("이 생리 기록 삭제")')
  await a.waitForTimeout(400)
  await a.mouse.click(20, 60)

  // ── ③ A 초대 코드 생성 ───────────────────────────────────
  await a.click('.bottom-nav a[href="/settings"]')
  await a.click('button:has-text("초대 코드 만들기")')
  await a.waitForSelector('.invite-code')
  const code = (await a.textContent('.invite-code'))?.trim() ?? ''
  check('③ A 초대 코드 생성', /^[A-Z2-9]{6}$/.test(code), `코드: ${code}`)
  await shot(a, '04-A-invite')

  // 🔍 공유 토글을 실제로 클릭했을 때 반영되는지 (UI 경로)
  const shareToggle = 'input[aria-label="연인에게 내 주기 보여주기"]'
  await a.click(shareToggle)
  await a.waitForTimeout(500)
  const offMe = await apiCall(a, '/me')
  check('🔍 공유 토글 클릭 → OFF 저장', offMe.json.user.shareCycle === false)
  await a.click(shareToggle)
  await a.waitForTimeout(500)
  const onMe = await apiCall(a, '/me')
  check('🔍 공유 토글 재클릭 → ON 복구', onMe.json.user.shareCycle === true)

  // ── ③ B(도하) 가입 — 추적 안 함 → 코드로 연결 ─────────────
  const ctxB = await browser.newContext({ viewport })
  const b = await ctxB.newPage()
  await signup(b, B)
  await b.click('text=연인의 달력을 함께 보러 왔어요')
  await b.waitForURL('**/settings')

  // 🔍 프로브: 잘못된 초대 코드
  await b.fill('.inline-form input', 'ZZZZ99')
  await b.click('.inline-form button')
  await b.waitForSelector('.form-error:not(:empty)')
  const wrongCodeErr = (await b.textContent('.form-error'))?.trim()
  check('🔍 잘못된 초대 코드 → 에러 안내', wrongCodeErr === '초대 코드를 찾을 수 없어요.', wrongCodeErr)

  // 진짜 코드로 연결
  await b.fill('.inline-form input', code)
  await b.click('.inline-form button')
  await b.waitForSelector(`text=${A.name}님과 연결되어 있어요`)
  check('③ B 커플 연결 완료', true)

  // ── ③ B 홈: A의 상태 카드(히어로) ─────────────────────────
  await b.click('.bottom-nav a[href="/"]')
  await b.waitForSelector('.hero-owner')
  const owner = (await b.textContent('.hero-owner'))?.trim()
  const bDday = (await b.textContent('.dday'))?.trim()
  check(
    '③ B 홈에 지혜의 주기 히어로 표시',
    owner === '지혜님의 이번 주기' && bDday === EXPECTED_DDAY,
    `${owner} / ${bDday}`,
  )
  await b.waitForTimeout(1400)
  await shot(b, '05-B-home')

  // B 캘린더에도 지혜 주기 표시
  await b.click('.bottom-nav a[href="/calendar"]')
  await b.waitForSelector('.cal-band') // 파트너 주기 렌더까지 대기
  const bBands = await b.evaluate(() => document.querySelectorAll('.cal-band').length)
  const bNote = (await b.textContent('.page'))?.includes('지혜님의 주기가 표시되고 있어요')
  check('③ B 캘린더에 지혜 주기 밴드 + 안내 문구', bBands > 0 && !!bNote, `밴드 ${bBands}개`)
  await shot(b, '06-B-calendar')

  // ── ④ A 공유 일정 등록 → B에서 보임 ──────────────────────
  await a.goto(`${BASE}/calendar`) // 연결 후 fresh 로드 (hasCouple 갱신)
  await a.waitForSelector('.cal-grid')
  await a.click('button[aria-label="2026-07-25"]')
  await a.waitForSelector('.sheet')
  await a.waitForSelector('.share-toggle input:checked') // 커플 정보 도착 + 함께 기본 켜짐
  await a.fill('.event-form input', '저녁 데이트')
  await a.click('.event-form button:has-text("추가")')
  await a.waitForSelector('.event-row:has-text("저녁 데이트")')
  check('④ A 공유 일정 등록 (7/25 저녁 데이트)', true)

  await b.reload()
  await b.waitForSelector('.cal-grid')
  await b.click('button[aria-label="2026-07-25"]')
  await b.waitForSelector('.sheet')
  const evRow = await b.textContent('.event-row:has-text("저녁 데이트")')
  const delBtnCount = await b.locator('.event-row:has-text("저녁 데이트") .event-del').count()
  check(
    '④ B 캘린더에 공유 일정 표시 (함께 배지, 삭제 불가)',
    !!evRow && evRow.includes('함께') && delBtnCount === 0,
    evRow?.replace(/\s+/g, ' ').trim(),
  )
  await shot(b, '07-B-shared-event')
  await b.mouse.click(20, 60)

  // B 홈 다가오는 일정에도 표시
  await b.goto(`${BASE}/`)
  await b.waitForSelector('.event-row')
  const bHomeEvents = await b.textContent('.card:has(.event-row)')
  check('④ B 홈 다가오는 일정에 표시', !!bHomeEvents?.includes('저녁 데이트'))

  // ── ④ 프라이버시: A의 일기는 B에게 절대 안 보임 ───────────
  const partnerRaw = await apiCall(b, '/partner?today=2026-07-18')
  const rawStr = JSON.stringify(partnerRaw.json)
  check(
    '④ /api/partner 응답에 증상/기분/메모 없음',
    !rawStr.includes('비밀') && !rawStr.includes('복통') && !rawStr.includes('mood') && !rawStr.includes('memo'),
  )
  const bPageHasSecret = await b.evaluate(() => document.body.innerText.includes('비밀 메모'))
  check('④ B 화면 어디에도 A의 메모 텍스트 없음', !bPageHasSecret)

  // 🔍 프로브: A가 주기 공유를 끄면 B에서 사라짐
  await apiCall(a, '/me', 'PATCH', { shareCycle: false })
  const hidden = await apiCall(b, '/partner?today=2026-07-18')
  check('🔍 공유 OFF → 파트너 주기 숨김', hidden.json.connected === true && hidden.json.cycle === null)
  await apiCall(a, '/me', 'PATCH', { shareCycle: true })
  const shown = await apiCall(b, '/partner?today=2026-07-18')
  check('🔍 공유 ON 복구 → 다시 보임', shown.json.cycle !== null)

  // 🔍 프로브: 미래 시작일 / 겹침 / 중복 아이디
  const future = await apiCall(a, '/periods', 'POST', { start_date: '2026-09-01' })
  check('🔍 미래 생리 시작일 → 400', future.status === 400, future.json.error)
  const overlap = await apiCall(a, '/periods', 'POST', { start_date: '2026-07-01' })
  check('🔍 겹치는 생리 기간 → 409', overlap.status === 409, overlap.json.error)
  const dupe = await a.evaluate(async (username) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'xxxxxxxx' }),
    })
    return { status: res.status, json: await res.json() }
  }, A.username)
  check('🔍 중복 아이디 가입 → 409', dupe.status === 409, dupe.json.error)

  // 🔍 프로브: 비로그인 API 접근
  const noAuth = await b.evaluate(async () => {
    const res = await fetch('/api/predictions')
    return res.status
  })
  check('🔍 토큰 없는 API 접근 → 401', noAuth === 401)
} catch (err) {
  check('시나리오 실행 중단', false, String(err))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n결과: ${results.length - failed.length}/${results.length} 통과`)
process.exit(failed.length > 0 ? 1 : 0)
