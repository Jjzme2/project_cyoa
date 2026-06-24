import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { adminDb } from '@/lib/firebase-admin'

/** Whether the signed-in user has TOTP 2FA enabled. */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ enabled: false })
  const doc = await adminDb.collection('userSettings').doc(auth.uid).get()
  return NextResponse.json({ enabled: doc.exists ? !!doc.data()?.totpEnabled : false })
}
