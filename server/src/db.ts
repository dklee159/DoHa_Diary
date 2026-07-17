import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH ?? path.join(here, '..', 'data.db')

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
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

export function getUserById(id: number): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
}

export function getPartnerOf(user: UserRow): UserRow | undefined {
  if (!user.couple_id) return undefined
  return db
    .prepare('SELECT * FROM users WHERE couple_id = ? AND id != ?')
    .get(user.couple_id, user.id) as UserRow | undefined
}
