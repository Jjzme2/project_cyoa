import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { adminDb } from '@/lib/firebase-admin'
import { verifyTotp, decryptSecret } from '@/lib/totp'

const CodeSchema = z.object({ code: z.coerce.string().default('') })

/** Verify a code for the post-login second-factor gate. */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 })

  const parsed = await parseJson(req, CodeSchema)
  if (!parsed.ok) return parsed.response
  const { code } = parsed.data

  const data = (await adminDb.collection('userSettings').doc(auth.uid).get()).data()
  const enc = data?.totpSecretEnc as string | undefined
  // No 2FA configured → nothing to gate.
  if (!data?.totpEnabled || !enc) return NextResponse.json({ ok: true })

  return NextResponse.json({ ok: verifyTotp(code, decryptSecret(enc)) })
}
