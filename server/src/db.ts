import { createClient, type InValue } from '@libsql/client'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const localFile = process.env.DB_PATH ?? path.join(here, '..', 'data.db')

// 프로덕션(Render)에서는 Turso 클라우드 DB, 로컬 개발에서는 SQLite 파일을 그대로 쓴다.
export const db = createClient(
  process.env.TURSO_DATABASE_URL
    ? {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : { url: `file:${localFile.replace(/\\/g, '/')}` },
)

await db.executeMultiple(`
CREATE TABLE IF NOT EXISTS couples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  couple_id INTEGER REFERENCES couples(id) ON DELETE SET NULL,
  tracking_enabled INTEGER NOT NULL DEFAULT 1,
  share_cycle INTEGER NOT NULL DEFAULT 1,
  cycle_len_override INTEGER,
  period_len_override INTEGER,
  onboarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_periods_user ON periods(user_id, start_date);

CREATE TABLE IF NOT EXISTS daily_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  mood TEXT,
  symptoms TEXT NOT NULL DEFAULT '[]',
  flow TEXT,
  memo TEXT NOT NULL DEFAULT '',
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couple_id INTEGER REFERENCES couples(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'etc',
  is_shared INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_events_couple ON events(couple_id, date);
`)

export async function queryAll<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  const rs = await db.execute({ sql, args })
  return rs.rows as unknown as T[]
}

export async function queryOne<T>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await queryAll<T>(sql, args))[0]
}

export async function run(
  sql: string,
  args: InValue[] = [],
): Promise<{ changes: number; lastId: number }> {
  const rs = await db.execute({ sql, args })
  return { changes: rs.rowsAffected, lastId: Number(rs.lastInsertRowid ?? 0) }
}

// 하나의 트랜잭션으로 묶어 실행한다
export async function batchWrite(stmts: { sql: string; args?: InValue[] }[]): Promise<void> {
  await db.batch(
    stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    'write',
  )
}

export interface UserRow {
  id: number
  username: string
  password_hash: string
  display_name: string
  couple_id: number | null
  tracking_enabled: number
  share_cycle: number
  cycle_len_override: number | null
  period_len_override: number | null
  onboarded: number
}

export function getUserById(id: number): Promise<UserRow | undefined> {
  return queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [id])
}

export async function getPartnerOf(user: UserRow): Promise<UserRow | undefined> {
  if (!user.couple_id) return undefined
  return queryOne<UserRow>('SELECT * FROM users WHERE couple_id = ? AND id != ?', [
    user.couple_id,
    user.id,
  ])
}
