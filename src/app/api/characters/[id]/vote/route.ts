import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getCharacter, toggleCharacterVote } from '@/lib/firestore-helpers'

/** Whether the caller has voted for this character, and the public count. Auth optional. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const character = await getCharacter(id)
  if (!character) return NextResponse.json({ error: 'Character not found' }, { status: 404 })

  const auth = await getAuthContext(req).catch(() => null)
  const voted = auth ? (character.voterIds ?? []).includes(auth.uid) : false
  return NextResponse.json({ voted, count: character.voteCount ?? 0 })
}

/** Toggle the caller's "best character" vote. Sign-in required. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Sign in to vote' }, { status: 401 })

  const character = await getCharacter(id)
  if (!character) return NextResponse.json({ error: 'Character not found' }, { status: 404 })

  const result = await toggleCharacterVote(id, auth.uid)
  return NextResponse.json(result)
}
