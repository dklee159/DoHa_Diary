import express from 'express'
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
app.use(express.json())

// 배포 플랫폼(Render/Railway) 헬스체크용
app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
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

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`도하 다이어리 서버 실행 중: http://localhost:${port}`)
})
