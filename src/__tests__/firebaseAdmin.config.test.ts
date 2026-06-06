import { afterEach, describe, expect, it } from 'vitest'
import { getFirebaseServiceAccount } from '../config/firebaseAdmin.js'

const ORIGINAL_ENV = process.env

describe('getFirebaseServiceAccount', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('reads FIREBASE_SA_B64 as base64 JSON', () => {
    process.env = { ...ORIGINAL_ENV, FIREBASE_SA_B64: Buffer.from('{"project_id":"kapital"}').toString('base64') }

    expect(getFirebaseServiceAccount()).toEqual({ project_id: 'kapital' })
  })

  it('accepts legacy FIREBASE_SERVICE_ACCOUNT as raw JSON', () => {
    process.env = { ...ORIGINAL_ENV, FIREBASE_SA_B64: '', FIREBASE_SERVICE_ACCOUNT: '{"project_id":"legacy"}' }

    expect(getFirebaseServiceAccount()).toEqual({ project_id: 'legacy' })
  })

  it('accepts legacy FIREBASE_SERVICE_ACCOUNT as base64 JSON', () => {
    process.env = {
      ...ORIGINAL_ENV,
      FIREBASE_SA_B64: '',
      FIREBASE_SERVICE_ACCOUNT: Buffer.from('{"project_id":"legacy-b64"}').toString('base64'),
    }

    expect(getFirebaseServiceAccount()).toEqual({ project_id: 'legacy-b64' })
  })
})
