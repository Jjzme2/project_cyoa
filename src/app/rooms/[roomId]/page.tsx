import type { Metadata } from 'next'
import { RoomReader } from '@/components/rooms/RoomReader'

export const metadata: Metadata = {
  title: 'Reading room',
  robots: { index: false }, // ephemeral session pages aren't for indexing
}

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  return (
    <div className="px-4 py-6 sm:py-10">
      <RoomReader roomId={roomId} />
    </div>
  )
}
