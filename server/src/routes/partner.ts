import { Router, type Request, type Response } from 'express'
import { db, getPartnerOf } from '../db.js'
import { currentUser } from '../auth.js'
import { isDateStr, todayStr } from '../util.js'
import { calcPredictions, todaySummary, type PeriodRecord } from '../cycle.js'

export const partnerRouter = Router()

// 연결 상태 + 파트너의 주기 요약.
// 파트너가 공유를 껐거나 추적하지 않으면 cycle은 null이다.
// daily_logs(증상/기분/메모)는 어떤 경우에도 파트너에게 내려가지 않는다.
partnerRouter.get('/', (req: Request, res: Response) => {
  const me = currentUser(res)
  const today = isDateStr(req.query.today) ? req.query.today : todayStr()

  if (!me.couple_id) {
    return res.json({ connected: false, pending: false })
  }

  const partner = getPartnerOf(me)
  if (!partner) {
    const couple = db.prepare('SELECT invite_code FROM couples WHERE id = ?').get(me.couple_id) as
      | { invite_code: string }
      | undefined
    return res.json({ connected: false, pending: true, inviteCode: couple?.invite_code ?? null })
  }

  let cycle = null
  if (partner.tracking_enabled && partner.share_cycle) {
    const periods = db
      .prepare('SELECT start_date, end_date FROM periods WHERE user_id = ? ORDER BY start_date')
      .all(partner.id) as PeriodRecord[]
    const prediction = calcPredictions(periods, {
      cycleLenOverride: partner.cycle_len_override,
      periodLenOverride: partner.period_len_override,
    })
    cycle = { periods, prediction, today: todaySummary(today, periods, prediction) }
  }

  res.json({
    connected: true,
    pending: false,
    partner: { displayName: partner.display_name },
    cycle,
  })
})
