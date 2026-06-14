import type { Metadata } from 'next'
import { Suspense } from 'react'
import { RoomReader } from '@/components/rooms/RoomReader'

export const metadata: Metadata = {
  title: 'Reading room',
  robots: { index: false }, // ephemeral session pages aren't for indexing
}

async function RoomContent({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  return <RoomReader roomId={roomId} />
}

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  return (
    <div className="px-4 py-6 sm:py-10">
      <Suspense
        fallback={
          <div className="max-w-2xl mx-auto py-24 text-center text-sm text-muted-foreground/50">
            Loading room…
          </div>
        }
      >
        <RoomContent params={params} />
      </Suspense>
    </div>
  )
}
