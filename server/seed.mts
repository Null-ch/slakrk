import { readFileSync } from 'node:fs'
import { createAccount, signIn, removeSession, store, validName } from './accounts.mts'

const input: unknown = JSON.parse(readFileSync(0, 'utf8'))
if (!Array.isArray(input) || !input.every((row) => typeof row?.name === 'string' && validName(row.name) && typeof row.password === 'string' && row.password.length >= 8 && row.password.length <= 128)) {
  throw new Error('Invalid account list')
}
store.exec('BEGIN IMMEDIATE')
try {
  for (const { name, password } of input) {
    if (!createAccount(name, password)) {
      const session = signIn(name, password)
      if (!session) throw new Error('An account already exists with a different password')
      removeSession(session.token)
    }
  }
  store.exec('COMMIT')
  console.log('Accounts provisioned:', input.map(({ name }) => name).join(', '))
} catch (error) {
  store.exec('ROLLBACK')
  throw error
}
