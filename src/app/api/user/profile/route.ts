import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { CreditManager } from '@/lib/credit-manager'
import { StripeService, isStripeMocked } from '@/lib/stripe'
import { ageFromDob, MIN_SITE_AGE } from '@/lib/ratings'
import { UserProfile } from '@/types'

/**
 * User Profile & Billing API
 * Declares all imports/constants at the absolute top of the file.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const uid = decoded.uid

    // Get Firestore userSettings
    const userSettingsRef = adminDb.collection('userSettings').doc(uid)
    const settingsSnap = await userSettingsRef.get()
    const settingsData = settingsSnap.exists ? settingsSnap.data()! : {}

    // Enforce class model instantiating
    const profile = UserProfile.fromFirestore(uid, {
      email: decoded.email ?? null,
      displayName: decoded.name ?? null,
      photoURL: decoded.picture ?? null,
      ...settingsData,
    })

    // Get credits breakdown
    const credits = await CreditManager.getCreditsInfo(uid, profile.tier)

    // Fetch user's authored stories and worlds from Firestore collections
    const [storiesSnap, worldsSnap] = await Promise.all([
      adminDb.collection('stories').where('authorId', '==', uid).get(),
      adminDb.collection('worlds').where('authorId', '==', uid).get(),
    ])

    const stories = storiesSnap.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title ?? 'Untitled',
      description: doc.data().description ?? '',
      createdAt: doc.data().createdAt ?? '',
      nodeCount: doc.data().nodeCount ?? 1,
      views: doc.data().views ?? 0,
      published: doc.data().published !== false,
      coverGradient: doc.data().coverGradient ?? '',
    }))

    const worlds = worldsSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name ?? 'Unnamed World',
      description: doc.data().description ?? '',
      createdAt: doc.data().createdAt ?? '',
    }))

    return NextResponse.json({
      profile: profile.toFirestore(),
      credits,
      isStripeMocked,
      stories,
      worlds,
    })
  } catch (err) {
    console.error('[User Profile GET error]:', err)
    return NextResponse.json({ error: 'Failed to retrieve profile' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const uid = decoded.uid

    const body = await req.json()
    const { action } = body

    if (action === 'set_dob') {
      const { dateOfBirth, attestation } = body
      if (attestation !== true) {
        return NextResponse.json(
          { error: 'Please confirm your date of birth is accurate.' },
          { status: 400 },
        )
      }
      const age = ageFromDob(dateOfBirth)
      if (age === null) {
        return NextResponse.json({ error: 'Enter a valid date of birth.' }, { status: 400 })
      }
      if (age < MIN_SITE_AGE) {
        return NextResponse.json(
          { error: `You must be at least ${MIN_SITE_AGE} years old to use Chronicle.` },
          { status: 403 },
        )
      }

      await adminDb.collection('userSettings').doc(uid).set({ dateOfBirth }, { merge: true })
      // Persist as a custom claim so the server can age-gate cheaply from the token.
      const existing = (await adminAuth.getUser(uid)).customClaims ?? {}
      await adminAuth.setCustomUserClaims(uid, { ...existing, dob: dateOfBirth })

      return NextResponse.json({ ok: true, age })
    }

    if (action === 'portal') {
      const url = await StripeService.createPortalSession(uid)
      return NextResponse.json({ url })
    }

    if (action === 'mock_checkout' && isStripeMocked) {
      const { type, creditsAmount } = body
      await StripeService.processMockCheckout({
        userId: uid,
        type,
        creditsAmount: Number(creditsAmount || 0),
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[User Profile POST error]:', err)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
