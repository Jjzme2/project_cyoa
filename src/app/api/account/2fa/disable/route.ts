import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAuthContext } from '@/lib/auth'
import { adminDb } from '@/lib/firebase-admin'
import { verifyTotp, decryptSecret } from '@/lib/totp'

/** Disable 2FA — requires a current valid code so a hijacked session alone can't. */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '')

  const ref = adminDb.collection('userSettings').doc(auth.uid)
  const data = (await ref.get()).data()
  const enc = data?.totpSecretEnc as string | undefined
  if (!data?.totpEnabled || !enc) return NextResponse.json({ ok: true })

  if (!verifyTotp(code, decryptSecret(enc))) {
    return NextResponse.json({ error: 'Enter a current code to disable 2FA.' }, { status: 400 })
  }

  await ref.set(
    { totpEnabled: false, totpSecretEnc: FieldValue.delete(), updatedAt: new Date().toISOString() },
    { merge: true },
  )
  return NextResponse.json({ ok: true })
}
