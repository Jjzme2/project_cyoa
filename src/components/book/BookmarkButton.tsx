'use client'

import { useState, useEffect } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/Providers'

interface Props {
  storyId: string
}

export function BookmarkButton({ storyId }: Props) {
  const { user, openAuthModal } = useAuth()
  const [bookmarked, setBookmarked] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    user.getIdToken().then(async (token) => {
      const res = await fetch(`/api/bookmarks?storyId=${storyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setBookmarked(data.bookmarked)
      }
    })
  }, [user, storyId])

  async function toggle() {
    if (!user) {
      openAuthModal()
      return
    }
    if (loading) return
    setLoading(true)
    try {
      const token = await user.getIdToken()
      if (bookmarked) {
        await fetch(`/api/bookmarks?storyId=${storyId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        setBookmarked(false)
        toast('Bookmark removed.')
      } else {
        await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ storyId }),
        })
        setBookmarked(true)
        toast.success('Story bookmarked!')
      }
    } catch {
      toast.error('Could not update bookmark.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={bookmarked ? 'Remove bookmark' : 'Bookmark this story'}
      className={`flex items-center gap-1 text-[10px] font-sans transition-colors px-2 py-1 rounded border bg-white/[0.01] ${
        bookmarked
          ? 'text-amber-400 border-amber-500/30 bg-amber-500/[0.08]'
          : 'text-muted-foreground/55 hover:text-muted-foreground/70 border-white/[0.05] hover:border-white/10'
      }`}
    >
      {bookmarked ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
      <span>{bookmarked ? 'Bookmarked' : 'Bookmark'}</span>
    </button>
  )
}
