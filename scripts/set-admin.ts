/**
 * Grants or revokes the `admin` role for a user, persisted as a Firebase custom
 * claim so it propagates to the client ID token.
 *
 * Run with:
 *   npx tsx scripts/set-admin.ts <email>            # grant admin
 *   npx tsx scripts/set-admin.ts <email> --revoke   # remove admin
 *
 * The user must already have signed in at least once. They'll need to refresh
 * their token (sign out/in) for the new claim to take effect client-side.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const email = process.argv[2]
const REVOKE = process.argv.includes('--revoke')

if (!email || email.startsWith('--')) {
  console.error('Usage: npx tsx scripts/set-admin.ts <email> [--revoke]')
  process.exit(1)
}

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

async function main() {
  const auth = getAuth(getAdminApp())
  const userRecord = await auth.getUserByEmail(email)

  const existing = userRecord.customClaims ?? {}
  const nextClaims = { ...existing }
  if (REVOKE) {
    delete nextClaims.role
  } else {
    nextClaims.role = 'admin'
  }

  await auth.setCustomUserClaims(userRecord.uid, nextClaims)
  console.log(
    `${REVOKE ? 'Revoked admin from' : 'Granted admin to'} ${email} (uid: ${userRecord.uid}).`,
  )
  console.log('They must refresh their session (sign out/in) for it to take effect.')
}

main().catch((err) => {
  console.error('Failed:', err.message)
  process.exit(1)
})
