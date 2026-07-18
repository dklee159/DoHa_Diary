import { Router, type Request, type Response } from 'express'
import { queryAll } from '../db.js'
import { currentUser } from '../auth.js'
import { ah, isDateStr, todayStr } from '../util.js'
import { calcPredictions, todaySummary, type PeriodRecord } from '../cycle.js'

export const predictionsRouter = Router()

predictionsRouter.get(
  '/',
  ah(async (req: Request, res: Response) => {
    const me = currentUser(res)
    const today = isDateStr(req.query.today) ? req.query.today : todayStr()

    // id 포함: 클라이언트가 기록 수정/삭제 시 필요하다
    const periods = await queryAll<PeriodRecord & { id: number }>(
      'SELECT id, start_date, end_date FROM periods WHERE user_id = ? ORDER BY start_date',
      [me.id],
    )
    const prediction = calcPredictions(periods, {
      cycleLenOverride: me.cycle_len_override,
      periodLenOverride: me.period_len_override,
    })
    res.json({ periods, prediction, today: todaySummary(today, periods, prediction) })
  }),
)
