import { NextRequest, NextResponse } from 'next/server'
import { getStoryGallery } from '@/lib/firestore-helpers'

/** Returns every illustration in a story (published routes only). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const images = await getStoryGallery(id).catch(() => [])
  return NextResponse.json({ images })
}
