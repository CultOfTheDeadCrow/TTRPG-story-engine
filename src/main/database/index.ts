import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { getDatabasePath } from './path'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

export function initDatabase(): Database.Database {
  const dbPath = getDatabasePath()

  // Ensure parent directory exists (especially for dev-data/)
  mkdirSync(dirname(dbPath), { recursive: true })

  db = new Database(dbPath)

  // D-04: Set pragmas on every DB open
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  console.log('[db] Opened database at', dbPath)

  runMigrations(db)

  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('[db] Database closed')
  }
}
