import { Router, type Request, type Response } from 'express'
import { queryAll, queryOne, run } from '../db.js'
import { currentUser } from '../auth.js'
import { ah, isDateStr, todayStr } from '../util.js'
import type { PeriodRecord } from '../cycle.js'

export const periodsRouter = Router()

interface PeriodRow extends PeriodRecord {
  id: number
  user_id: number
}

function listPeriods(userId: number): Promise<PeriodRow[]> {
  return queryAll<PeriodRow>(
    'SELECT id, user_id, start_date, end_date FROM periods WHERE user_id = ? ORDER BY start_date',
    [userId],
  )
}

// [start, end]가 기존 기록과 겹치는지. end_date 미정(진행중)은 시작일 하루로 취급해 검증.
async function overlaps(
  userId: number,
  start: string,
  end: string | null,
  excludeId?: number,
): Promise<boolean> {
  const effectiveEnd = end ?? start
  for (const p of await listPeriods(userId)) {
    if (excludeId !== undefined && p.id === excludeId) continue
    const pEnd = p.end_date ?? p.start_date
    if (start <= pEnd && p.start_date <= effectiveEnd) return true
  }
  return false
}

function validateBody(body: unknown): { start: string; end: string | null } | { error: string } {
  const { start_date, end_date } = (body ?? {}) as Record<string, unknown>
  if (!isDateStr(start_date)) return { error: '시작일이 올바르지 않아요.' }
  if (start_date > todayStr()) return { error: '시작일은 오늘 이후일 수 없어요.' }
  let end: string | null = null
  if (end_date !== undefined && end_date !== null && end_date !== '') {
    if (!isDateStr(end_date)) return { error: '종료일이 올바르지 않아요.' }
    if (end_date < start_date) return { error: '종료일은 시작일보다 빠를 수 없어요.' }
    end = end_date
  }
  return { start: start_date, end }
}

periodsRouter.get(
  '/',
  ah(async (_req: Request, res: Response) => {
    res.json({ periods: await listPeriods(currentUser(res).id) })
  }),
)

periodsRouter.post(
  '/',
  ah(async (req: Request, res: Response) => {
    const me = currentUser(res)
    const parsed = validateBody(req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    if (await overlaps(me.id, parsed.start, parsed.end)) {
      return res.status(409).json({ error: '이미 기록된 생리 기간과 겹쳐요.' })
    }
    const info = await run('INSERT INTO periods (user_id, start_date, end_date) VALUES (?, ?, ?)', [
      me.id,
      parsed.start,
      parsed.end,
    ])
    res.status(201).json({ id: info.lastId })
  }),
)

periodsRouter.put(
  '/:id',
  ah(async (req: Request, res: Response) => {
    const me = currentUser(res)
    const id = Number(req.params.id)
    const row = await queryOne('SELECT id FROM periods WHERE id = ? AND user_id = ?', [id, me.id])
    if (!row) return res.status(404).json({ error: '기록을 찾을 수 없어요.' })

    const parsed = validateBody(req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    if (await overlaps(me.id, parsed.start, parsed.end, id)) {
      return res.status(409).json({ error: '이미 기록된 생리 기간과 겹쳐요.' })
    }
    await run('UPDATE periods SET start_date = ?, end_date = ? WHERE id = ?', [
      parsed.start,
      parsed.end,
      id,
    ])
    res.json({ ok: true })
  }),
)

periodsRouter.delete(
  '/:id',
  ah(async (req: Request, res: Response) => {
    const me = currentUser(res)
    const info = await run('DELETE FROM periods WHERE id = ? AND user_id = ?', [
      Number(req.params.id),
      me.id,
    ])
    if (info.changes === 0) return res.status(404).json({ error: '기록을 찾을 수 없어요.' })
    res.json({ ok: true })
  }),
)
