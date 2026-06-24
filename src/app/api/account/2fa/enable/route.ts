import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAuthContext } from '@/lib/auth'
import { adminDb } from '@/lib/firebase-admin'
import { verifyTotp, decryptSecret } from '@/lib/totp'

/** Finish enrolment: verify a code against the pending secret, then activate it. */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '')

  const ref = adminDb.collection('userSettings').doc(auth.uid)
  const enc = (await ref.get()).data()?.totpPendingEnc as string | undefined
  if (!enc) return NextResponse.json({ error: 'Start the setup first.' }, { status: 400 })

  if (!verifyTotp(code, decryptSecret(enc))) {
    return NextResponse.json({ error: 'That code is incorrect — use the current one.' }, { status: 400 })
  }

  await ref.set(
    { totpEnabled: true, totpSecretEnc: enc, totpPendingEnc: FieldValue.delete(), updatedAt: new Date().toISOString() },
    { merge: true },
  )
  return NextResponse.json({ ok: true })
}
