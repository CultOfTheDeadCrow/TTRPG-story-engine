import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getApiKey, setApiKey, getApiKeyStatus } from '../src/main/services/settings'

// Identity encrypt/decrypt functions for testing (no safeStorage dependency)
const identityEncrypt = (text: string): Buffer => Buffer.from(text, 'utf8')
const identityDecrypt = (buf: Buffer): string => buf.toString('utf8')

let tmpDir: string
let settingsPath: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'shadowrun-test-'))
  settingsPath = join(tmpDir, 'settings.json')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('setApiKey + getApiKey', () => {
  it('stores and retrieves an API key', () => {
    setApiKey('test-key', settingsPath, identityEncrypt)
    const result = getApiKey(settingsPath, identityDecrypt)
    expect(result).toBe('test-key')
  })

  it('returns null when no key is set', () => {
    const result = getApiKey(settingsPath, identityDecrypt)
    expect(result).toBeNull()
  })

  it('clears the key when setApiKey is called with empty string', () => {
    setApiKey('test-key', settingsPath, identityEncrypt)
    setApiKey('', settingsPath, identityEncrypt)
    const result = getApiKey(settingsPath, identityDecrypt)
    expect(result).toBeNull()
  })
})

describe('getApiKeyStatus', () => {
  it('returns { configured: true } after setting a key', () => {
    setApiKey('my-api-key', settingsPath, identityEncrypt)
    const status = getApiKeyStatus(settingsPath, identityDecrypt)
    expect(status).toEqual({ configured: true })
  })

  it('returns { configured: false } when no key is set', () => {
    const status = getApiKeyStatus(settingsPath, identityDecrypt)
    expect(status).toEqual({ configured: false })
  })

  it('returns { configured: false } after key is cleared', () => {
    setApiKey('my-api-key', settingsPath, identityEncrypt)
    setApiKey('', settingsPath, identityEncrypt)
    const status = getApiKeyStatus(settingsPath, identityDecrypt)
    expect(status).toEqual({ configured: false })
  })
})
