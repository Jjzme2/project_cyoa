import { ImageResponse } from 'next/og'
import { APP_CONFIG } from './config'
import { clamp } from './og'
import { accentFor, normalizeStats, type ShareCardKind, type ShareCardStat } from './share-card-helpers'

export { accentFor, normalizeStats, rarityStat } from './share-card-helpers'
export type { ShareCardKind, ShareCardStat } from './share-card-helpers'

/**
 * Portrait, social-native "Share Card" renderer.
 *
 * Where {@link renderOgImage} produces a 1200×630 landscape card for link
 * previews, this produces a 1080×1350 (4:5) portrait card sized for an
 * Instagram / feed post or a Discord drop — the deliberate, screenshot-able
 * artifact a reader saves and shares. One renderer serves every unit
 * (an ending reached, a world, and — once they exist — a character) so the
 * brand reads the same everywhere.
 *
 * Satori (behind next/og) supports flexbox and a subset of CSS only — no grid.
 */

export const shareCardSize = { width: 1080, height: 1350 }
export const shareCardContentType = 'image/png'

export interface ShareCardOptions {
  kind: ShareCardKind
  /** Letter-spaced kicker above the title (world name, "AN ENDING", etc.). */
  eyebrow: string
  title: string
  subtitle?: string
  /** Optional hero image (cover / illustration / portrait / map) embedded up top. */
  imageUrl?: string
  /** Up to three stat chips along the bottom (collected, reached, traveled…). */
  stats?: ShareCardStat[]
  /** A small attribution line in the footer, e.g. "by Ada". */
  footerNote?: string
  /** Override the per-kind accent (e.g. an ending's type colour). */
  accent?: string
}

export function renderShareCard(opts: ShareCardOptions): ImageResponse {
  const accent = opts.accent ?? accentFor(opts.kind)
  const stats = normalizeStats(opts.stats)
  const hasHero = Boolean(opts.imageUrl)

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(160deg, #0a0a0f 0%, #1c1407 100%)',
          color: '#fafafa',
          fontFamily: 'serif',
        }}
      >
        {/* Hero image, fading into the card so text sits on solid ground */}
        {hasHero ? (
          <div style={{ display: 'flex', position: 'relative', width: '100%', height: 620 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={opts.imageUrl}
              alt=""
              width={shareCardSize.width}
              height={620}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(10,10,15,0) 45%, #0a0a0f 100%)',
              }}
            />
          </div>
        ) : null}

        {/* Body */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: hasHero ? 'flex-start' : 'center',
            padding: hasHero ? '8px 72px 0' : '0 72px',
            marginTop: hasHero ? -40 : 0,
          }}
        >
          <div style={{ display: 'flex', fontSize: 28, letterSpacing: 8, color: accent }}>
            {clamp(opts.eyebrow, 42).toUpperCase()}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 88,
              fontWeight: 700,
              lineHeight: 1.04,
              color: '#fdf6e3',
              marginTop: 22,
            }}
          >
            {clamp(opts.title, 70)}
          </div>

          {opts.subtitle ? (
            <div
              style={{
                display: 'flex',
                fontSize: 36,
                lineHeight: 1.32,
                color: 'rgba(250,250,250,0.6)',
                marginTop: 26,
                maxWidth: 900,
              }}
            >
              {clamp(opts.subtitle, 160)}
            </div>
          ) : null}

          {stats.length ? (
            <div style={{ display: 'flex', gap: 20, marginTop: 40, flexWrap: 'wrap' }}>
              {stats.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '18px 26px',
                    borderRadius: 18,
                    border: `1px solid ${accent}40`,
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: accent }}>
                    {clamp(s.value, 18)}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      fontSize: 23,
                      color: 'rgba(250,250,250,0.5)',
                      marginTop: 4,
                      fontFamily: 'sans-serif',
                    }}
                  >
                    {clamp(s.label, 28)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer brand bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '36px 72px 56px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, color: '#f5d896' }}>
            {APP_CONFIG.site.name} <span style={{ color: 'rgba(250,250,250,0.4)' }}> · write your own path</span>
          </div>
          {opts.footerNote ? (
            <div style={{ display: 'flex', fontSize: 26, color: 'rgba(250,250,250,0.45)' }}>
              {clamp(opts.footerNote, 34)}
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...shareCardSize },
  )
}
