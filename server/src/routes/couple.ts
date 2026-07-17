import { Router, type Request, type Response } from 'express'
import { randomInt } from 'node:crypto'
import { db, getPartnerOf } from '../db.js'
import { currentUser } from '../auth.js'

export const coupleRouter = Router()

// 혼동하기 쉬운 문자(0/O, 1/I/L)를 뺀 초대 코드 문자셋
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateCode(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = ''
    for (let i = 0; i < 6; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)]
    const exists = db.prepare('SELECT id FROM couples WHERE invite_code = ?').get(code)
    if (!exists) return code
  }
  throw new Error('초대 코드 생성에 실패했습니다.')
}

coupleRouter.post('/invite', (_req: Request, res: Response) => {
  const me = currentUser(res)
  if (me.couple_id) {
    const partner = getPartnerOf(me)
    if (partner) return res.status(409).json({ error: '이미 연인과 연결되어 있어요.' })
    // 대기 중이면 기존 코드 재사용
    const couple = db.prepare('SELECT invite_code FROM couples WHERE id = ?').get(me.couple_id) as
      | { invite_code: string }
      | undefined
    if (couple) return res.json({ inviteCode: couple.invite_code })
  }

  const code = generateCode()
  const create = db.transaction(() => {
    const info = db.prepare('INSERT INTO couples (invite_code) VALUES (?)').run(code)
    db.prepare('UPDATE users SET couple_id = ? WHERE id = ?').run(info.lastInsertRowid, me.id)
  })
  create()
  res.status(201).json({ inviteCode: code })
})

coupleRouter.post('/join', (req: Request, res: Response) => {
  const me = currentUser(res)
  if (me.couple_id) {
    return res.status(409).json({ error: '이미 커플 연결(또는 대기) 중이에요. 먼저 해제해 주세요.' })
  }
  const { code } = req.body ?? {}
  if (typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: '초대 코드를 입력해 주세요.' })
  }
  const couple = db
    .prepare('SELECT id FROM couples WHERE invite_code = ?')
    .get(code.trim().toUpperCase()) as { id: number } | undefined
  if (!couple) return res.status(404).json({ error: '초대 코드를 찾을 수 없어요.' })

  const memberCount = db
    .prepare('SELECT COUNT(*) AS n FROM users WHERE couple_id = ?')
    .get(couple.id) as { n: number }
  if (memberCount.n >= 2) return res.status(409).json({ error: '이미 연결이 완료된 코드예요.' })
  if (memberCount.n === 0) return res.status(404).json({ error: '유효하지 않은 코드예요.' })

  db.prepare('UPDATE users SET couple_id = ? WHERE id = ?').run(couple.id, me.id)
  res.json({ ok: true })
})

coupleRouter.delete('/', (_req: Request, res: Response) => {
  const me = currentUser(res)
  if (!me.couple_id) return res.status(400).json({ error: '연결된 커플이 없어요.' })

  const disconnect = db.transaction(() => {
    db.prepare('UPDATE users SET couple_id = NULL WHERE couple_id = ?').run(me.couple_id)
    // events.couple_id는 ON DELETE SET NULL → 공유 일정은 각자의 개인 일정으로 남는다.
    db.prepare('DELETE FROM couples WHERE id = ?').run(me.couple_id)
  })
  disconnect()
  res.json({ ok: true })
})
