import { NextResponse } from 'next/server'
import { getLiveSeasons } from '@/lib/firestore-helpers'

/**
 * Public: the live seasons right now (published, in-window), soonest-ending
 * first. Drives the player-facing Season banner. No auth — these are meant to
 * be seen by everyone.
 */
export async function GET() {
  const seasons = await getLiveSeasons()
  return NextResponse.json(
    { seasons },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
