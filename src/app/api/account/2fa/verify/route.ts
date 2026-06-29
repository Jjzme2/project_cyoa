import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
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

  const ok = verifyTotp(code, decryptSecret(enc))
  if (ok) {
    // Bind the pass to the session SERVER-SIDE: stamp a verified-at custom claim
    // so the server (not just the client) can attest 2FA was satisfied this
    // session — preserving any other claims. The client refreshes its token
    // (`refresh`) so the new claim propagates and sensitive routes can require it.
    const existing = (await adminAuth.getUser(auth.uid).then((u) => u.customClaims).catch(() => ({}))) ?? {}
    await adminAuth.setCustomUserClaims(auth.uid, { ...existing, twofaVerifiedAt: Date.now() })
  }

  return NextResponse.json({ ok, refresh: ok })
}
