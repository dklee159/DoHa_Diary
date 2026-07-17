import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'
import { currentUser } from '../auth.js'
import { isDateStr } from '../util.js'

export const eventsRouter = Router()

const CATEGORIES = ['date', 'anniversary', 'trip', 'etc']

interface EventRow {
  id: number
  user_id: number
  couple_id: number | null
  date: string
  title: string
  category: string
  is_shared: number
}

function toClient(row: EventRow, myId: number) {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    category: row.category,
    isShared: !!row.is_shared,
    mine: row.user_id === myId,
  }
}

// 내 일정 + (커플 연결 시) 파트너의 공유 일정
eventsRouter.get('/', (req: Request, res: Response) => {
  const me = currentUser(res)
  const { from, to } = req.query
  if (!isDateStr(from) || !isDateStr(to)) {
    return res.status(400).json({ error: 'from/to 날짜가 필요해요.' })
  }
  const rows = db
    .prepare(
      `SELECT * FROM events
       WHERE date BETWEEN ? AND ?
         AND (user_id = ? OR (is_shared = 1 AND couple_id IS NOT NULL AND couple_id = ?))
       ORDER BY date, id`,
    )
    .all(from, to, me.id, me.couple_id ?? -1) as EventRow[]
  res.json({ events: rows.map((r) => toClient(r, me.id)) })
})

function validateBody(body: unknown): { date: string; title: string; category: string; shared: boolean } | { error: string } {
  const { date, title, category, isShared } = (body ?? {}) as Record<string, unknown>
  if (!isDateStr(date)) return { error: '날짜가 올바르지 않아요.' }
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 50) {
    return { error: '일정 제목은 1~50자여야 해요.' }
  }
  const cat = typeof category === 'string' && CATEGORIES.includes(category) ? category : 'etc'
  return { date, title: title.trim(), category: cat, shared: !!isShared }
}

eventsRouter.post('/', (req: Request, res: Response) => {
  const me = currentUser(res)
  const parsed = validateBody(req.body)
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })

  // 커플 미연결이면 공유 일정은 개인 일정으로 저장된다.
  const coupleId = parsed.shared && me.couple_id ? me.couple_id : null
  const info = db
    .prepare('INSERT INTO events (user_id, couple_id, date, title, category, is_shared) VALUES (?, ?, ?, ?, ?, ?)')
    .run(me.id, coupleId, parsed.date, parsed.title, parsed.category, coupleId ? 1 : 0)
  res.status(201).json({ id: Number(info.lastInsertRowid) })
})

eventsRouter.put('/:id', (req: Request, res: Response) => {
  const me = currentUser(res)
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(id, me.id) as
    | EventRow
    | undefined
  if (!row) return res.status(404).json({ error: '일정을 찾을 수 없어요.' })

  const parsed = validateBody(req.body)
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })

  const coupleId = parsed.shared && me.couple_id ? me.couple_id : null
  db.prepare(
    'UPDATE events SET date = ?, title = ?, category = ?, couple_id = ?, is_shared = ? WHERE id = ?',
  ).run(parsed.date, parsed.title, parsed.category, coupleId, coupleId ? 1 : 0, id)
  res.json({ ok: true })
})

eventsRouter.delete('/:id', (req: Request, res: Response) => {
  const me = currentUser(res)
  const info = db
    .prepare('DELETE FROM events WHERE id = ? AND user_id = ?')
    .run(Number(req.params.id), me.id)
  if (info.changes === 0) return res.status(404).json({ error: '일정을 찾을 수 없어요.' })
  res.json({ ok: true })
})
