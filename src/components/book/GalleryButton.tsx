'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Images, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface GalleryImage {
  nodeId: string
  imageUrl: string
  choiceText: string | null
  excerpt: string
}

/** Toolbar button that opens a dialog of a story's generated illustrations. */
export function GalleryButton({ storyId }: { storyId: string }) {
  const [open, setOpen] = useState(false)
  const [images, setImages] = useState<GalleryImage[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/stories/${storyId}/gallery`)
      if (res.ok) {
        const data = await res.json()
        setImages(data.images ?? [])
      } else {
        setImages([])
      }
    } catch {
      setImages([])
    } finally {
      setLoading(false)
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next && images === null && !loading) load()
  }

  return (
    <>
      <button
        onClick={() => onOpenChange(true)}
        title="Illustration gallery"
        aria-label="Illustration gallery"
        className="flex items-center justify-center h-8 w-8 rounded-full text-amber-400/50 hover:text-amber-300 transition-colors"
      >
        <Images className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-strong border-white/15 sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="gold-text text-lg">Illustration gallery</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-amber-400/50" />
            </div>
          ) : images && images.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {images.map((img) => (
                <figure key={img.nodeId} className="space-y-1.5">
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-white/10">
                    <Image
                      src={img.imageUrl}
                      alt={img.choiceText ?? 'Story illustration'}
                      fill
                      sizes="(max-width: 640px) 100vw, 320px"
                      className="object-cover"
                    />
                  </div>
                  {img.choiceText && (
                    <figcaption className="text-[11px] text-muted-foreground/55 italic leading-snug">
                      “{img.choiceText}”
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          ) : (
            <p className="text-center py-12 text-muted-foreground/45 text-sm">
              No illustrations in this story yet. Add one when you contribute a path.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
