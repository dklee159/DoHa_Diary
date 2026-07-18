import type { NextFunction, Request, RequestHandler, Response } from 'express'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Express 4는 async 핸들러의 reject를 잡지 못하므로 next(err)로 넘겨준다
export function ah(
  fn: (req: Request, res: Response) => Promise<unknown>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
  }
}

export function isDateStr(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

// 서버 로컬(사용자 기기와 같은 KST 가정) 기준 오늘 날짜
export function todayStr(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
