import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { changePassword, createAccount, currentAccount, removeSession, signIn, validName } from './accounts.mts'

const root = resolve('dist')
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
}
const attempts = new Map<string, { count: number; until: number }>()
function blocked(key: string, limit: number) {
  const now = Date.now()
  for (const [entry, value] of attempts) if (value.until < now) attempts.delete(entry)
  if (attempts.size >= 5000 && !attempts.has(key)) return true
  const row = attempts.get(key) ?? { count: 0, until: now + 15 * 60_000 }
  if (row.count >= limit) return true
  row.count++
  attempts.set(key, row)
  return false
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(data))
}

async function auth(req: IncomingMessage, res: ServerResponse, path: string) {
  const secure = req.headers['x-forwarded-proto'] === 'https'
  const token = /(?:^|; )stop_jir_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1] ?? ''
  const cookie = (value: string, age: number) => `stop_jir_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`
  if (path === '/api/session' && req.method === 'GET') {
    const account = token && currentAccount(token)
    return json(res, account ? 200 : 401, account || { error: 'Войдите в аккаунт.' })
  }
  if (req.method !== 'POST' || !['/api/login', '/api/register', '/api/logout', '/api/password'].includes(path)) return json(res, 404, { error: 'Страница не найдена.' })
  const origin = `${secure ? 'https' : 'http'}://${req.headers.host}`
  if (req.headers.origin !== origin) return json(res, 403, { error: 'Недопустимый источник запроса.' })
  if (path === '/api/logout') {
    if (token) removeSession(token)
    res.setHeader('Set-Cookie', cookie('', 0))
    return json(res, 200, { ok: true })
  }
  const address = String(req.headers['x-real-ip'] ?? req.socket.remoteAddress ?? '')
  if (blocked(path + ':' + address, path === '/api/register' ? 8 : 30)) return json(res, 429, { error: 'Слишком много попыток. Попробуйте позже.' })
  if (!/^application\/json(?:;|$)/.test(req.headers['content-type'] ?? '')) return json(res, 415, { error: 'Ожидается JSON.' })
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 4096) return json(res, 413, { error: 'Запрос слишком большой.' })
    chunks.push(chunk)
  }
  let body: { name?: unknown; password?: unknown; next?: unknown } | null
  try { body = JSON.parse(Buffer.concat(chunks).toString()) }
  catch { return json(res, 400, { error: 'Некорректный запрос.' }) }
  if (path === '/api/password') {
    const account = token && currentAccount(token)
    if (!account || typeof account.id !== 'string') return json(res, 401, { error: 'Войдите в аккаунт.' })
    const previous = body?.password
    const next = body?.next
    if (typeof previous !== 'string' || previous.length < 8 || previous.length > 128 || typeof next !== 'string' || next.length < 12 || next.length > 128) return json(res, 400, { error: 'Новый пароль должен содержать от 12 до 128 символов.' })
    if (!changePassword(account.id, previous, next)) return json(res, 403, { error: 'Текущий пароль не совпадает.' })
    res.setHeader('Set-Cookie', cookie('', 0))
    return json(res, 200, { ok: true })
  }
  const name = typeof body?.name === 'string' ? body.name.trim().toLowerCase() : ''
  const password = body?.password
  if (!validName(name) || typeof password !== 'string' || password.length < (path === '/api/register' ? 12 : 8) || password.length > 128) {
    return json(res, 400, { error: 'Проверьте логин и пароль.' })
  }
  if (path === '/api/login' && blocked('login:' + name, 12)) return json(res, 429, { error: 'Слишком много попыток. Попробуйте позже.' })
  if (path === '/api/register' && !createAccount(name, password)) return json(res, 409, { error: 'Логин уже занят.' })
  const session = signIn(name, password)
  if (!session) return json(res, 401, { error: 'Неверный логин или пароль.' })
  attempts.delete('login:' + name)
  if (token) removeSession(token)
  res.setHeader('Set-Cookie', cookie(session.token, session.ttl))
  return json(res, 200, session.account)
}

createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  try {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    if (path.startsWith('/api/')) { await auth(req, res, path); return }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return }
    const file = resolve(root, '.' + decodeURIComponent(path))
    if (!file.startsWith(root + sep) && file !== root) { res.writeHead(404).end(); return }
    const ext = extname(file)
    const data = await readFile(ext ? file : resolve(root, 'index.html'))
    res.writeHead(200, { 'Content-Type': mime[ext || '.html'] ?? 'application/octet-stream',
      'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' })
    res.end(req.method === 'HEAD' ? undefined : data)
  } catch (error) {
    if (res.headersSent || res.destroyed) return
    const status = error instanceof URIError ? 400 : (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 500
    json(res, status, { error: 'Не удалось обработать запрос.' })
  }
}).listen(8080, '0.0.0.0')
