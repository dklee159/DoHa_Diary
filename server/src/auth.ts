import { Router, type Request, type Response, type NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getUserById, queryOne, run, type UserRow } from './db.js'
import { ah } from './util.js'

// 로컬 개발용 기본 시크릿. 실서버 배포 시 JWT_SECRET 환경변수를 반드시 설정할 것.
const JWT_SECRET = process.env.JWT_SECRET ?? 'doha-diary-dev-secret'
const TOKEN_TTL = '30d'

export const authRouter = Router()

function issueToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: TOKEN_TTL })
}

function publicUser(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    coupleId: u.couple_id,
    trackingEnabled: !!u.tracking_enabled,
    shareCycle: !!u.share_cycle,
    cycleLenOverride: u.cycle_len_override,
    periodLenOverride: u.period_len_override,
    onboarded: !!u.onboarded,
  }
}

authRouter.post(
  '/signup',
  ah(async (req: Request, res: Response) => {
    const { username, password, displayName } = req.body ?? {}
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: '아이디는 영문/숫자/_ 3~20자여야 합니다.' })
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' })
    }
    const name =
      typeof displayName === 'string' && displayName.trim() ? displayName.trim() : username
    if (name.length > 20) {
      return res.status(400).json({ error: '이름은 20자 이하여야 합니다.' })
    }

    const exists = await queryOne('SELECT id FROM users WHERE username = ?', [username])
    if (exists) return res.status(409).json({ error: '이미 사용 중인 아이디예요.' })

    const hash = bcrypt.hashSync(password, 10)
    const info = await run(
      'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
      [username, hash, name],
    )
    const user = (await getUserById(info.lastId))!

    res.status(201).json({ token: issueToken(user.id), user: publicUser(user) })
  }),
)

authRouter.post(
  '/login',
  ah(async (req: Request, res: Response) => {
    const { username, password } = req.body ?? {}
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: '아이디와 비밀번호를 입력해 주세요.' })
    }
    const user = await queryOne<UserRow>('SELECT * FROM users WHERE username = ?', [username])
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않아요.' })
    }
    res.json({ token: issueToken(user.id), user: publicUser(user) })
  }),
)

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' })

  let userId: number
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    userId = Number((payload as jwt.JwtPayload).sub)
  } catch {
    return res.status(401).json({ error: '로그인이 만료되었어요. 다시 로그인해 주세요.' })
  }

  getUserById(userId)
    .then((user) => {
      if (!user) return res.status(401).json({ error: '로그인이 필요합니다.' })
      res.locals.user = user
      next()
    })
    .catch(next)
}

export function currentUser(res: Response): UserRow {
  return res.locals.user as UserRow
}

export const meRouter = Router()

meRouter.get('/', (_req: Request, res: Response) => {
  res.json({ user: publicUser(currentUser(res)) })
})

meRouter.patch(
  '/',
  ah(async (req: Request, res: Response) => {
    const me = currentUser(res)
    const {
      displayName,
      trackingEnabled,
      shareCycle,
      cycleLenOverride,
      periodLenOverride,
      onboarded,
    } = req.body ?? {}

    const updates: Record<string, string | number | null> = {}
    if (displayName !== undefined) {
      if (
        typeof displayName !== 'string' ||
        !displayName.trim() ||
        displayName.trim().length > 20
      ) {
        return res.status(400).json({ error: '이름은 1~20자여야 합니다.' })
      }
      updates.display_name = displayName.trim()
    }
    if (trackingEnabled !== undefined) updates.tracking_enabled = trackingEnabled ? 1 : 0
    if (shareCycle !== undefined) updates.share_cycle = shareCycle ? 1 : 0
    if (onboarded !== undefined) updates.onboarded = onboarded ? 1 : 0
    for (const [key, value] of [
      ['cycle_len_override', cycleLenOverride],
      ['period_len_override', periodLenOverride],
    ] as const) {
      if (value === undefined) continue
      if (value === null) {
        updates[key] = null
      } else if (typeof value === 'number' && Number.isInteger(value) && value >= 2 && value <= 90) {
        updates[key] = value
      } else {
        return res.status(400).json({ error: '주기/기간 값이 올바르지 않아요. (2~90일)' })
      }
    }

    const keys = Object.keys(updates)
    if (keys.length > 0) {
      const setSql = keys.map((k) => `${k} = ?`).join(', ')
      await run(`UPDATE users SET ${setSql} WHERE id = ?`, [
        ...keys.map((k) => updates[k]),
        me.id,
      ])
    }
    res.json({ user: publicUser((await getUserById(me.id))!) })
  }),
)
