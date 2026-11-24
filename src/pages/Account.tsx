import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { db, defaultProfile, initializeAccount } from '../db/database'
import { importBackup, readBackup } from '../domain/backup'
import { localDate } from '../domain/dates'
import { recommendPlan, planInputSchema } from '../domain/personalPlan'

type Account = { id: string; name: string }
const sessionKey = 'stop-jir-tab-account'
const sessionChange = 'stop-jir-session-change'

function updateTabs() {
  localStorage.setItem(sessionChange, crypto.randomUUID())
}

function exitAccount() {
  sessionStorage.removeItem(sessionKey)
  updateTabs()
  window.location.replace('/')
}

async function request(path: string, fields?: object) {
  const response = await fetch('/api/' + path, {
    cache: 'no-store',
    ...(fields ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) } : {}),
  })
  return { response, data: await response.json() }
}

function selectAccount(account?: Account) {
  if (account) {
    initializeAccount(account.id)
    sessionStorage.setItem(sessionKey, JSON.stringify(account))
  } else sessionStorage.removeItem(sessionKey)
  return account
}

export function AccountGate({ children }: { children: (account: Account) => ReactNode }) {
  const [account, setAccount] = useState<Account>()
  const [ready, setReady] = useState(false)
  const [register, setRegister] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void request('session').then(({ response, data }) => {
      if (active) setAccount(selectAccount(response.ok ? data : undefined))
    }).catch(() => {
      if (!active) return
      const cached = sessionStorage.getItem(sessionKey)
      if (cached && !navigator.onLine) setAccount(selectAccount(JSON.parse(cached)))
      else setMessage('Для входа нужно подключение к интернету.')
    }).finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    function onChange(event: StorageEvent) {
      if (event.key === sessionChange) {
        sessionStorage.removeItem(sessionKey)
        window.location.reload()
      }
    }
    window.addEventListener('storage', onChange)
    return () => window.removeEventListener('storage', onChange)
  }, [])

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const { response, data } = await request(register ? 'register' : 'login', { name: form.get('name'), password: form.get('password') })
      if (!response.ok) { setMessage(data.error); return }
      setAccount(selectAccount(data))
      updateTabs()
      setMessage('')
    } catch { setMessage('Связь с сервером прервана. Попробуйте снова.') }
    finally { setBusy(false) }
  }

  if (!ready) return <main className="content"><p role="status">Проверяем вход…</p></main>
  if (account) return <ProfileGate>{children(account)}</ProfileGate>
  return <main className="content max-w-md">
    <header className="page-heading"><h1>Моё похудение</h1></header>
    <form key={String(register)} className="panel form-grid" onSubmit={authenticate}>
      <h2>{register ? 'Регистрация' : 'Вход в личный кабинет'}</h2>
      <label>Логин<input name="name" required autoComplete="username" pattern="[A-Za-z0-9_]{3,32}" /></label>
      <label>Пароль<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : 8} maxLength={128} required /></label>
      {register && <p className="muted">Логин латиницей, пароль от 12 символов.</p>}
      <button className="action" disabled={busy}>{register ? 'Создать аккаунт' : 'Войти'}</button>
      <button className="secondary" type="button" onClick={() => { setRegister(!register); setMessage('') }}>{register ? 'Уже есть аккаунт' : 'Зарегистрироваться'}</button>
      <p role="status">{message}</p>
    </form>
  </main>
}

export function AccountControls({ name }: { name: string }) {
  const [message, setMessage] = useState('')
  async function logout() {
    try {
      const { response } = await request('logout', {})
      if (!response.ok) throw new Error()
      exitAccount()
    } catch { setMessage('Чтобы выйти, подключитесь к интернету.') }
  }
  async function password(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    try {
      const { response, data } = await request('password', { password: fields.get('current'), next: fields.get('next') })
      if (!response.ok) { setMessage(data.error); return }
      exitAccount()
    } catch { setMessage('Связь с сервером прервана.') }
  }
  return <>
    <div className="flex flex-wrap items-center gap-3"><span>{name}</span><button className="secondary" onClick={() => void logout()}>Выйти</button></div>
    <details className="section-gap"><summary>Сменить пароль</summary>
      <form className="form-grid section-gap" onSubmit={password}>
        <label>Текущий пароль<input name="current" type="password" autoComplete="current-password" required /></label>
        <label>Новый пароль<input name="next" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <button className="action">Сохранить новый пароль</button>
      </form>
    </details>
    <p role="status">{message}</p>
  </>
}

function ProfileGate({ children }: { children: ReactNode }) {
  const profile = useLiveQuery(async () => (await db.profiles.get('profile')) ?? null)
  if (profile === undefined) return <main className="content"><p role="status">Открываем профиль…</p></main>
  if (profile) return children
  return <main className="content max-w-xl"><header className="page-heading"><h1>Ваш план</h1></header><PlanForm /></main>
}

export function PlanForm() {
  const [message, setMessage] = useState('')
  const [importVisible, setImportVisible] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const result = planInputSchema.safeParse({
      startingWeightKg: Number(fields.get('weight')), heightCm: Number(fields.get('height')),
      ageYears: Number(fields.get('age')), sex: fields.get('sex'),
    })
    if (!result.success) { setMessage('Проверьте возраст, рост и вес.'); return }
    const estimate = recommendPlan(result.data, localDate())
    if (!estimate) { setMessage('При недостаточном весе автоматический план похудения недоступен. Можно восстановить существующий профиль из резервной копии.'); return }
    try {
      await db.transaction('rw', db.profiles, db.programs, async () => {
        await db.profiles.add({ ...defaultProfile, ...result.data, autoPlan: true,
          goals: estimate.goals, estimatedMaintenance: estimate.maintenance, appliedActivity: estimate.level })
        await db.programs.put({ id: 'program', started: localDate() })
      })
    } catch { setMessage('Не удалось сохранить план. Попробуйте снова.') }
  }

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = new FormData(event.currentTarget).get('backup')
    if (!(file instanceof File) || !file.size) return
    try {
      await importBackup(readBackup(await file.text()))
    } catch { setMessage('Проверьте файл резервной копии.') }
  }

  return <>
    <form className="panel form-grid" onSubmit={save}>
      <h2>Четыре параметра для старта</h2>
      <label>Вес, кг<input name="weight" type="number" min="35" max="300" step="0.1" required /></label>
      <label>Рост, см<input name="height" type="number" min="130" max="230" step="0.1" required /></label>
      <label>Возраст<input name="age" type="number" min="18" max="78" required /></label>
      <label>Пол<select name="sex" defaultValue="" required><option value="" disabled>Выберите</option><option>Мужской</option><option>Женский</option></select></label>
      <label className="!flex items-center"><input className="!w-5" type="checkbox" required /> Мне подходит обычная физическая нагрузка и у меня нет медицинских ограничений, беременности или грудного вскармливания.</label>
      <p className="muted">Стартовая оценка предполагает сидячий день. Меню содержит яйца, молочные продукты и рыбу. Сверьте состав со своими ограничениями.</p>
      <button className="action">Сформировать план на 21 день</button>
      <button type="button" className="secondary" onClick={() => setImportVisible(!importVisible)}>У меня есть резервная копия</button>
    </form>
    {importVisible && <form className="panel form-grid section-gap" onSubmit={restore}><label>Резервная копия<input name="backup" type="file" accept=".json,application/json" required /></label><button className="action">Восстановить профиль</button></form>}
    <p role="status">{message}</p>
  </>
}
