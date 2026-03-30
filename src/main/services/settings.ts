import { readFileSync, writeFileSync, existsSync } from 'fs'

interface SettingsFile {
  apiKeyEncrypted?: string
}

function readSettings(settingsPath: string): SettingsFile {
  if (!existsSync(settingsPath)) return {}
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8')) as SettingsFile
  } catch {
    return {}
  }
}

function writeSettings(settingsPath: string, settings: SettingsFile): void {
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
}

export function getApiKey(
  settingsPath: string,
  decryptFn?: (buf: Buffer) => string
): string | null {
  const settings = readSettings(settingsPath)
  if (!settings.apiKeyEncrypted) return null

  try {
    const buf = Buffer.from(settings.apiKeyEncrypted, 'hex')
    const key = decryptFn ? decryptFn(buf) : buf.toString('utf8')
    return key.length > 0 ? key : null
  } catch {
    return null
  }
}

export function setApiKey(
  key: string,
  settingsPath: string,
  encryptFn?: (text: string) => Buffer
): void {
  const settings = readSettings(settingsPath)

  if (!key) {
    delete settings.apiKeyEncrypted
  } else {
    const buf = encryptFn ? encryptFn(key) : Buffer.from(key, 'utf8')
    settings.apiKeyEncrypted = buf.toString('hex')
  }

  writeSettings(settingsPath, settings)
}

export function getApiKeyStatus(
  settingsPath: string,
  decryptFn?: (buf: Buffer) => string
): { configured: boolean } {
  const key = getApiKey(settingsPath, decryptFn)
  return { configured: key !== null && key.length > 0 }
}
