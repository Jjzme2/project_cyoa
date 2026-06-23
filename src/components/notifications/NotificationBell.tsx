'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, BookOpen, Trophy, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/components/Providers'
import type { Notification } from '@/types'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function NotificationBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  async function fetchNotifications() {
    if (!user) return
    setLoading(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
        setUnread(data.unreadCount)
      }
    } finally {
      setLoading(false)
    }
  }

  // Mount load — inline .then() so setState calls land in async callbacks, not synchronously in the effect
  useEffect(() => {
    if (!user) return
    user.getIdToken()
      .then((token) => fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } }))
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return
        setNotifications(data.notifications)
        setUnread(data.unreadCount)
      })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function markAllRead() {
    if (!user) return
    const token = await user.getIdToken()
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'mark_all_read' }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }

  async function markRead(id: string) {
    if (!user) return
    const token = await user.getIdToken()
    fetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnread((u) => Math.max(0, u - 1))
  }

  if (!user) return null

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen((o) => !o)
          if (!open) fetchNotifications()
        }}
        className="relative h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-foreground transition-colors"
        title="Notifications"
      >
        <Bell className="h-3.5 w-3.5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black font-sans">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-10 w-80 z-50 glass border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-xs font-semibold text-foreground/70 font-sans uppercase tracking-wider">
                Notifications
              </span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] font-sans text-amber-400/60 hover:text-amber-400 transition-colors flex items-center gap-1"
                  >
                    <Check className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="py-8 text-center">
                  <div className="w-5 h-5 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground/50 font-sans">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors ${
                      !n.read ? 'bg-amber-500/[0.04]' : ''
                    }`}
                  >
                    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                      n.type === 'achievement_earned'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-white/5 text-muted-foreground/50'
                    }`}>
                      {n.type === 'achievement_earned' ? (
                        <Trophy className="h-3.5 w-3.5" />
                      ) : (
                        <BookOpen className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-[12px] leading-snug text-foreground/80">
                        {n.type === 'new_contribution' ? (
                          <>
                            <span className="font-medium">{n.contributorName}</span>
                            {' wrote a new path in '}
                            <span className="text-amber-300">{n.storyTitle}</span>
                          </>
                        ) : (
                          <>
                            Achievement unlocked: <span className="text-amber-300">{n.achievementId}</span>
                          </>
                        )}
                      </p>
                      {n.slotPrompt && (
                        <p className="text-[10px] text-muted-foreground/40 italic truncate">
                          &quot;{n.slotPrompt}&quot;
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/50 font-sans">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-2" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
