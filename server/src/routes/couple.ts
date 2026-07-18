import { Router, type Request, type Response } from 'express'
import { randomInt } from 'node:crypto'
import { batchWrite, getPartnerOf, queryOne, run } from '../db.js'
import { currentUser } from '../auth.js'
import { ah } from '../util.js'

export const coupleRouter = Router()

// 혼동하기 쉬운 문자(0/O, 1/I/L)를 뺀 초대 코드 문자셋
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

async function generateCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = ''
    for (let i = 0; i < 6; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)]
    const exists = await queryOne('SELECT id FROM couples WHERE invite_code = ?', [code])
    if (!exists) return code
  }
  throw new Error('초대 코드 생성에 실패했습니다.')
}

coupleRouter.post(
  '/invite',
  ah(async (_req: Request, res: Response) => {
    const me = currentUser(res)
    if (me.couple_id) {
      const partner = await getPartnerOf(me)
      if (partner) return res.status(409).json({ error: '이미 연인과 연결되어 있어요.' })
      // 대기 중이면 기존 코드 재사용
      const couple = await queryOne<{ invite_code: string }>(
        'SELECT invite_code FROM couples WHERE id = ?',
        [me.couple_id],
      )
      if (couple) return res.json({ inviteCode: couple.invite_code })
    }

    const code = await generateCode()
    // couples 생성 후 내 couple_id 연결. 중간 실패로 빈 커플이 남아도
    // join의 "멤버 0명 → 유효하지 않은 코드" 처리로 무해하다.
    const info = await run('INSERT INTO couples (invite_code) VALUES (?)', [code])
    await run('UPDATE users SET couple_id = ? WHERE id = ?', [info.lastId, me.id])
    res.status(201).json({ inviteCode: code })
  }),
)

coupleRouter.post(
  '/join',
  ah(async (req: Request, res: Response) => {
    const me = currentUser(res)
    if (me.couple_id) {
      return res
        .status(409)
        .json({ error: '이미 커플 연결(또는 대기) 중이에요. 먼저 해제해 주세요.' })
    }
    const { code } = req.body ?? {}
    if (typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: '초대 코드를 입력해 주세요.' })
    }
    const couple = await queryOne<{ id: number }>('SELECT id FROM couples WHERE invite_code = ?', [
      code.trim().toUpperCase(),
    ])
    if (!couple) return res.status(404).json({ error: '초대 코드를 찾을 수 없어요.' })

    const memberCount = (await queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM users WHERE couple_id = ?',
      [couple.id],
    ))!
    if (memberCount.n >= 2) return res.status(409).json({ error: '이미 연결이 완료된 코드예요.' })
    if (memberCount.n === 0) return res.status(404).json({ error: '유효하지 않은 코드예요.' })

    await run('UPDATE users SET couple_id = ? WHERE id = ?', [couple.id, me.id])
    res.json({ ok: true })
  }),
)

coupleRouter.delete(
  '/',
  ah(async (_req: Request, res: Response) => {
    const me = currentUser(res)
    if (!me.couple_id) return res.status(400).json({ error: '연결된 커플이 없어요.' })

    // 공유 일정은 각자의 개인 일정으로 남긴다.
    // (FK enforcement에 기대지 않고 명시적으로 couple_id를 비운다)
    await batchWrite([
      { sql: 'UPDATE users SET couple_id = NULL WHERE couple_id = ?', args: [me.couple_id] },
      { sql: 'UPDATE events SET couple_id = NULL WHERE couple_id = ?', args: [me.couple_id] },
      { sql: 'DELETE FROM couples WHERE id = ?', args: [me.couple_id] },
    ])
    res.json({ ok: true })
  }),
)
