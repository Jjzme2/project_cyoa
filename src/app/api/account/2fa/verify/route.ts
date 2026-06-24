import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { adminDb } from '@/lib/firebase-admin'
import { verifyTotp, decryptSecret } from '@/lib/totp'

/** Verify a code for the post-login second-factor gate. */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '')

  const data = (await adminDb.collection('userSettings').doc(auth.uid).get()).data()
  const enc = data?.totpSecretEnc as string | undefined
  // No 2FA configured → nothing to gate.
  if (!data?.totpEnabled || !enc) return NextResponse.json({ ok: true })

  return NextResponse.json({ ok: verifyTotp(code, decryptSecret(enc)) })
}
