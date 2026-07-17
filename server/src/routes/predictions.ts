import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'
import { currentUser } from '../auth.js'
import { isDateStr, todayStr } from '../util.js'
import { calcPredictions, todaySummary, type PeriodRecord } from '../cycle.js'

export const predictionsRouter = Router()

predictionsRouter.get('/', (req: Request, res: Response) => {
  const me = currentUser(res)
  const today = isDateStr(req.query.today) ? req.query.today : todayStr()

  const periods = db
    .prepare('SELECT start_date, end_date FROM periods WHERE user_id = ? ORDER BY start_date')
    .all(me.id) as PeriodRecord[]
  const prediction = calcPredictions(periods, {
    cycleLenOverride: me.cycle_len_override,
    periodLenOverride: me.period_len_override,
  })
  res.json({ periods, prediction, today: todaySummary(today, periods, prediction) })
})
