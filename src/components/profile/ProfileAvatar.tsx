'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/Providers'
import { FRAME_SKINS, findFrame, isFrameUnlocked } from '@/lib/cosmetics'

/**
 * The profile avatar plus its cosmetic frame picker — self-contained (fetches
 * its own equipped/earned state) so it drops into the profile header with no
 * plumbing from the parent page.
 */
export function ProfileAvatar({ photoURL, initials }: { photoURL?: string | null; initials: string }) {
  const { user } = useAuth()
  const [equipped, setEquipped] = useState('default')
  const [earned, setEarned] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    user.getIdToken().then(async (token) => {
      try {
        const res = await fetch('/api/profile/frame', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          setEquipped(data.equipped)
          setEarned(data.earned ?? [])
        }
      } finally {
        setLoaded(true)
      }
    })
  }, [user])

  async function equip(frameId: string) {
    if (!user || frameId === equipped) return
    const frame = findFrame(frameId)
    if (!isFrameUnlocked(frame, earned)) return
    const prev = equipped
    setEquipped(frameId) // optimistic
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/profile/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ frameId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setEquipped(prev)
      toast.error('Could not equip that frame — try again.')
    }
  }

  const frame = findFrame(equipped)

  return (
    <div className="flex flex-col items-center sm:items-start gap-3">
      <div
        className={`w-20 h-20 rounded-full overflow-hidden bg-amber-500/10 flex items-center justify-center text-xl text-amber-300 font-sans font-bold ${frame.ringClassName}`}
      >
        {photoURL ? (
          <Image src={photoURL} alt="Avatar" fill className="object-cover" sizes="80px" />
        ) : (
          initials
        )}
      </div>

      {loaded && (
        <div className="flex flex-wrap gap-1.5 max-w-[220px] justify-center sm:justify-start">
          {FRAME_SKINS.map((f) => {
            const unlocked = isFrameUnlocked(f, earned)
            return (
              <button
                key={f.id}
                type="button"
                title={unlocked ? f.name : `${f.name} — locked`}
                onClick={() => equip(f.id)}
                disabled={!unlocked}
                className={`h-6 w-6 rounded-full flex items-center justify-center transition-all ${f.ringClassName} ${
                  equipped === f.id ? 'opacity-100 scale-110' : unlocked ? 'opacity-70 hover:opacity-100' : 'opacity-25 cursor-not-allowed grayscale'
                }`}
              >
                {!unlocked && <Lock className="h-2.5 w-2.5 text-white/70" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
