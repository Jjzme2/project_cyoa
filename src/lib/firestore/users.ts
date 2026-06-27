import { adminDb } from '../firebase-admin'
import { decrypt } from '../encrypt'

// ─── User API Keys ─────────────────────────────────────────────────────────────

function userSettingsRef(userId: string) {
  return adminDb.collection('userSettings').doc(userId)
}

export async function getUserApiKey(userId: string): Promise<string | null> {
  const doc = await userSettingsRef(userId).get()
  return doc.exists ? (doc.data()?.encryptedGeminiKey ?? null) : null
}

export async function saveUserApiKey(userId: string, encryptedKey: string) {
  await userSettingsRef(userId).set({ encryptedGeminiKey: encryptedKey }, { merge: true })
}

export async function deleteUserApiKey(userId: string) {
  await userSettingsRef(userId).update({ encryptedGeminiKey: null })
}

export async function getDecryptedUserApiKey(userId: string): Promise<string | null> {
  const encrypted = await getUserApiKey(userId)
  if (!encrypted) return null
  try {
    return decrypt(encrypted)
  } catch {
    return null
  }
}

