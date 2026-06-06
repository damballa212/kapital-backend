export function getFirebaseServiceAccount(): Record<string, unknown> | null {
  const encoded = process.env.FIREBASE_SA_B64?.trim() || process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (!encoded) return null

  const json = encoded.startsWith('{')
    ? encoded
    : Buffer.from(encoded, 'base64').toString()

  return JSON.parse(json) as Record<string, unknown>
}
