import type React from 'react'
import type { CoverBorderFrame } from '@/types'

// ── Border frames ────────────────────────────────────────────────────────────
// CSS/Unicode-only decorative frames — no image assets to ship. Each frame is an
// inset border (solid / dashed / dotted) optionally adorned with a corner glyph.

export const BORDER_FRAMES: { id: CoverBorderFrame; label: string; corner: string | null }[] = [
  { id: 'none',      label: 'None',      corner: null },
  { id: 'single',    label: 'Single',    corner: null },
  { id: 'double',    label: 'Double',    corner: null },
  { id: 'ornate',    label: 'Ornate',    corner: '✦' },
  { id: 'runic',     label: 'Runic',     corner: 'ᛟ' },
  { id: 'thorn',     label: 'Thorn',     corner: '❧' },
  { id: 'celestial', label: 'Celestial', corner: '✶' },
  { id: 'vine',      label: 'Vine',      corner: '❦' },
]

const CORNER = Object.fromEntries(BORDER_FRAMES.map((b) => [b.id, b.corner])) as Record<
  CoverBorderFrame,
  string | null
>

interface CoverBorderProps {
  frame?: CoverBorderFrame
  accent?: string
  /** Frame inset from the cover edge, as a % of the cover (scales with size). */
  insetPct?: number
  /** Corner ornament size in px. Pass 0 to hide ornaments (tiny previews). */
  corner?: number
  className?: string
}

/**
 * Decorative frame overlay for a book cover / world portal. Render inside a
 * `relative` container; it fills the parent and is non-interactive.
 */
export function CoverBorder({
  frame = 'none',
  accent = '#fbbf24',
  insetPct = 6,
  corner = 12,
  className,
}: CoverBorderProps) {
  if (!frame || frame === 'none') return null

  const glyph = CORNER[frame]
  const isDouble = frame === 'double' || frame === 'ornate'
  const borderStyle = frame === 'runic' ? 'dashed' : frame === 'vine' ? 'dotted' : 'solid'
  const glow = frame === 'celestial' ? `0 0 6px ${accent}55, inset 0 0 9px ${accent}33` : undefined

  const cornerPositions: React.CSSProperties[] = [
    { top: `${insetPct}%`, left: `${insetPct}%`, transform: 'translate(-50%, -50%)' },
    { top: `${insetPct}%`, right: `${insetPct}%`, transform: 'translate(50%, -50%)' },
    { bottom: `${insetPct}%`, left: `${insetPct}%`, transform: 'translate(-50%, 50%)' },
    { bottom: `${insetPct}%`, right: `${insetPct}%`, transform: 'translate(50%, 50%)' },
  ]

  return (
    <div className={`absolute inset-0 pointer-events-none z-[5] ${className ?? ''}`}>
      {/* Outer frame line */}
      <div
        className="absolute rounded-[2px]"
        style={{
          inset: `${insetPct}%`,
          border: `1.5px ${borderStyle} ${accent}`,
          opacity: 0.82,
          boxShadow: glow,
        }}
      />
      {/* Inner hairline for double / ornate frames */}
      {isDouble && (
        <div
          className="absolute rounded-[1px]"
          style={{
            inset: `calc(${insetPct}% + 3px)`,
            border: `0.75px solid ${accent}`,
            opacity: 0.5,
          }}
        />
      )}
      {/* Corner ornaments */}
      {glyph &&
        corner > 0 &&
        cornerPositions.map((pos, i) => (
          <span
            key={i}
            className="absolute leading-none select-none"
            style={{
              ...pos,
              fontSize: corner,
              color: accent,
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            {glyph}
          </span>
        ))}
    </div>
  )
}
