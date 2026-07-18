# 도하 다이어리 ♥

생리 주기를 기록하면 가임기·배란일·다음 생리일을 예측해 주고,
연인과 주기 상태·일정을 함께 보는 커플 캘린더 PWA.

## 실행

```bash
npm install

# 개발 모드 (서버 3001 + 클라 5173, /api 프록시)
npm run dev

# 프로덕션 모드 (빌드 후 서버 하나로 서빙)
npm run build
npm start -w server   # → http://localhost:3001
```

첫 화면에서 회원가입 → 온보딩(주기 기록 여부 선택) → 홈.
커플 연결은 **설정 → 초대 코드 만들기** → 상대가 코드 입력.

## 테스트

```bash
npm test           # 주기 예측 알고리즘 단위 테스트 (vitest, 29개)
node e2e/run.mjs   # 두 계정 E2E 시나리오 (빌드 + 서버 기동 후, 시스템 Chrome 필요)
```

## 구조

```
server/  Express + better-sqlite3 + JWT  (src/cycle.ts = 예측 알고리즘)
client/  React + TS + Vite + PWA        (src/components/CycleArc.tsx = 주기 아치)
e2e/     Playwright 시나리오
```

## 예측 규칙 (표준 방식)

- 평균 주기 = 최근 6개 시작일 간격 평균 (기록 부족 시 온보딩 입력값, 기본 28일)
- 다음 생리 = 마지막 시작일 + 평균 주기 (3주기 투영)
- 배란일 = 예정일 − 14일 / 가임기 = 배란일 −5 ~ +1일 / PMS = 예정일 −4 ~ −1일

> 예측은 참고용이며 피임·의학적 판단에 사용할 수 없습니다.

## 배포 — 완전 무료 (Render free + Turso free)

DB는 Turso(SQLite 호환 클라우드, 카드 등록 불필요), 서버는 Render free 웹 서비스를 씁니다.
로컬 개발은 계정 없이 지금처럼 SQLite 파일을 그대로 사용합니다.

**1) GitHub에 푸시**

```bash
git remote add origin https://github.com/<계정>/doha-diary.git
git push -u origin main
```

**2) Turso DB 만들기** — [app.turso.tech](https://app.turso.tech) 가입(GitHub 로그인, 무료)

- Create Database → 이름 입력, 지역은 `ap-northeast-1 (Tokyo)` 권장
- 데이터베이스 화면에서 **URL**(`libsql://<db>-<org>.turso.io`)과 **Create Token**으로 토큰 복사

**3) Render 연결** — [render.com](https://render.com) 가입 후 New → **Blueprint** → 이 저장소 선택

- [render.yaml](render.yaml)이 서비스·헬스체크·JWT_SECRET을 자동 구성합니다
- 환경변수 입력창에 2)에서 복사한 `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`만 넣으면 끝

배포 후 `https://<도메인>/api/health` 가 `{"ok":true}` 를 반환하면 정상입니다.
HTTPS 도메인에서는 PWA 설치(홈 화면 추가)도 완전하게 동작합니다.

> Render free는 15분 미사용 시 잠들어 첫 접속이 30~60초 느립니다(이후엔 정상 속도).
> 유료로 올릴 생각이 있다면 [railway.json](railway.json)도 준비되어 있습니다
> (Railway: 30일 체험 후 월 $1 Free 플랜, 볼륨 마운트 `/data` + `DB_PATH=/data/data.db` 설정).

## 프라이버시

- 증상·기분·메모는 **본인만** 볼 수 있습니다 (파트너 API에 절대 미포함).
- 연인에게 보이는 것: 주기 상태 요약과 예측(끌 수 있음), 함께로 표시한 일정.
- 실서버 배포 시 `JWT_SECRET` 환경변수를 반드시 설정하세요.
- 로그인/가입과 초대 코드 입력은 IP당 분당 10회로 제한됩니다 (무차별 대입 방지).
