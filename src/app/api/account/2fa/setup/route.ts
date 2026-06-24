import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { adminDb } from '@/lib/firebase-admin'
import { newTotpSecret, totpKeyUri, encryptSecret } from '@/lib/totp'

/** Begin enrolment: generate a secret, store it (encrypted) as pending, and
 *  return the otpauth URL for the user's authenticator app. */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ref = adminDb.collection('userSettings').doc(auth.uid)
  const doc = await ref.get()
  if (doc.exists && doc.data()?.totpEnabled) {
    return NextResponse.json({ error: 'Two-factor auth is already enabled.' }, { status: 400 })
  }

  const secret = newTotpSecret()
  await ref.set({ totpPendingEnc: encryptSecret(secret), updatedAt: new Date().toISOString() }, { merge: true })
  return NextResponse.json({ otpauthUrl: totpKeyUri(auth.email ?? 'Chronicle account', secret) })
}
