import { NextResponse } from 'next/server'
import { listOpenBounties } from '@/lib/firestore-helpers'

/**
 * The global bounty board: every open bounty across every story. Degrades to
 * an empty list (rather than a hard error) if the required Firestore
 * collection-group index isn't deployed yet — see firestore.indexes.json.
 */
export async function GET() {
  try {
    const bounties = await listOpenBounties(30)
    return NextResponse.json({ bounties, ready: true })
  } catch (error) {
    console.error('[bounty board] query failed (index not deployed yet?):', error)
    return NextResponse.json({ bounties: [], ready: false })
  }
}
