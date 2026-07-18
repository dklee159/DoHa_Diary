import express from 'express'
import rateLimit from 'express-rate-limit'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { authRouter, authRequired, meRouter } from './auth.js'
import { periodsRouter } from './routes/periods.js'
import { logsRouter } from './routes/logs.js'
import { eventsRouter } from './routes/events.js'
import { coupleRouter } from './routes/couple.js'
import { partnerRouter } from './routes/partner.js'
import { predictionsRouter } from './routes/predictions.js'

const app = express()
// Render 등 프록시 뒤에서 실제 클라이언트 IP로 속도 제한을 걸기 위함
app.set('trust proxy', 1)
app.use(express.json())

// 배포 플랫폼(Render/Railway) 헬스체크용
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// 로그인/가입 무차별 대입 방지: IP당 분당 10회
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.' },
})

app.use('/api/auth', authLimiter, authRouter)
app.use('/api/me', authRequired, meRouter)
app.use('/api/periods', authRequired, periodsRouter)
app.use('/api/logs', authRequired, logsRouter)
app.use('/api/events', authRequired, eventsRouter)
app.use('/api/couple', authRequired, coupleRouter)
app.use('/api/partner', authRequired, partnerRouter)
app.use('/api/predictions', authRequired, predictionsRouter)

app.use('/api', (_req, res) => res.status(404).json({ error: '요청한 API를 찾을 수 없어요.' }))

// 프로덕션: 빌드된 클라이언트 정적 서빙 (client/dist가 있을 때만)
const here = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.join(here, '..', '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))
}

// async 핸들러에서 넘어온 예외의 최종 처리
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err)
    if (!res.headersSent) res.status(500).json({ error: '서버에 문제가 발생했어요.' })
  },
)

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`도하 다이어리 서버 실행 중: http://localhost:${port}`)
})
