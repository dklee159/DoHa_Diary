import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'
import { currentUser } from '../auth.js'
import { isDateStr } from '../util.js'

export const logsRouter = Router()

const MOODS = ['great', 'good', 'soso', 'bad', 'awful']
const FLOWS = ['light', 'medium', 'heavy']

interface LogRow {
  id: number
  user_id: number
  date: string
  mood: string | null
  symptoms: string
  flow: string | null
  memo: string
}

function toClient(row: LogRow) {
  return {
    date: row.date,
    mood: row.mood,
    symptoms: JSON.parse(row.symptoms) as string[],
    flow: row.flow,
    memo: row.memo,
  }
}

// 캘린더 범위 조회: /api/logs?from=2026-07-01&to=2026-07-31
logsRouter.get('/', (req: Request, res: Response) => {
  const me = currentUser(res)
  const { from, to } = req.query
  if (!isDateStr(from) || !isDateStr(to)) {
    return res.status(400).json({ error: 'from/to 날짜가 필요해요.' })
  }
  const rows = db
    .prepare('SELECT * FROM daily_logs WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date')
    .all(me.id, from, to) as LogRow[]
  res.json({ logs: rows.map(toClient) })
})

logsRouter.get('/:date', (req: Request, res: Response) => {
  const me = currentUser(res)
  const { date } = req.params
  if (!isDateStr(date)) return res.status(400).json({ error: '날짜가 올바르지 않아요.' })
  const row = db
    .prepare('SELECT * FROM daily_logs WHERE user_id = ? AND date = ?')
    .get(me.id, date) as LogRow | undefined
  res.json({ log: row ? toClient(row) : null })
})

logsRouter.put('/:date', (req: Request, res: Response) => {
  const me = currentUser(res)
  const { date } = req.params
  if (!isDateStr(date)) return res.status(400).json({ error: '날짜가 올바르지 않아요.' })

  const { mood, symptoms, flow, memo } = req.body ?? {}
  if (mood !== null && mood !== undefined && !MOODS.includes(mood)) {
    return res.status(400).json({ error: '기분 값이 올바르지 않아요.' })
  }
  if (flow !== null && flow !== undefined && !FLOWS.includes(flow)) {
    return res.status(400).json({ error: '생리량 값이 올바르지 않아요.' })
  }
  if (
    symptoms !== undefined &&
    (!Array.isArray(symptoms) || symptoms.some((s) => typeof s !== 'string' || s.length > 30))
  ) {
    return res.status(400).json({ error: '증상 값이 올바르지 않아요.' })
  }
  if (memo !== undefined && (typeof memo !== 'string' || memo.length > 2000)) {
    return res.status(400).json({ error: '메모는 2000자 이하여야 해요.' })
  }

  db.prepare(
    `INSERT INTO daily_logs (user_id, date, mood, symptoms, flow, memo)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET
       mood = excluded.mood, symptoms = excluded.symptoms,
       flow = excluded.flow, memo = excluded.memo`,
  ).run(
    me.id,
    date,
    mood ?? null,
    JSON.stringify(symptoms ?? []),
    flow ?? null,
    typeof memo === 'string' ? memo : '',
  )
  res.json({ ok: true })
})
