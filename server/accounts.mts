import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

export const store = new DatabaseSync(process.env.ACCOUNT_DB ?? '/data/accounts.sqlite')
store.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), expiry INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expiry);`)

export const validName = (value: string) => /^[a-z0-9_]{3,32}$/.test(value)
const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 64)
const digest = (token: string) => createHash('sha256').update(token).digest('hex')
const ttl = 60 * 60 * 24 * 14

export function createAccount(name: string, password: string) {
  if (!validName(name) || password.length < 8 || password.length > 128) return false
  const salt = randomBytes(24).toString('hex')
  return Number(store.prepare('INSERT OR IGNORE INTO accounts VALUES (?, ?, ?, ?)').run(randomBytes(16).toString('hex'), name, salt, hashPassword(password, salt).toString('hex')).changes) === 1
}

export function signIn(name: string, password: string) {
  const row = store.prepare('SELECT id, name, salt, hash FROM accounts WHERE name = ?').get(name) as
    { id: string; name: string; salt: string; hash: string } | undefined
  const calculated = hashPassword(password, row?.salt ?? 'unknown-account')
  if (!row || !timingSafeEqual(calculated, Buffer.from(row.hash, 'hex'))) return undefined
  const token = randomBytes(32).toString('hex')
  store.prepare('DELETE FROM sessions WHERE expiry <= ?').run(Date.now())
  store.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), row.id, Date.now() + ttl * 1000)
  return { account: { id: row.id, name: row.name }, token, ttl }
}

export function currentAccount(token: string) {
  return store.prepare('SELECT a.id, a.name FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token = ? AND s.expiry > ?')
    .get(digest(token), Date.now())
}

export function changePassword(id: string, previous: string, next: string) {
  const row = store.prepare('SELECT salt, hash FROM accounts WHERE id = ?').get(id) as {salt: string; hash: string} | undefined
  if (!row || !timingSafeEqual(hashPassword(previous, row.salt), Buffer.from(row.hash, 'hex'))) return false
  const salt = randomBytes(24).toString('hex')
  store.exec('BEGIN IMMEDIATE')
  try {
    store.prepare('UPDATE accounts SET salt = ?, hash = ? WHERE id = ?').run(salt, hashPassword(next, salt).toString('hex'), id)
    store.prepare('DELETE FROM sessions WHERE account_id = ?').run(id)
    store.exec('COMMIT')
    return true
  } catch (error) {
    store.exec('ROLLBACK')
    throw error
  }
}

export function removeSession(token: string) {
  store.prepare('DELETE FROM sessions WHERE token = ?').run(digest(token))
}
