import { ImageResponse } from 'next/og'
import { APP_CONFIG } from './config'

/**
 * Shared Open Graph / Twitter card image generator.
 *
 * Used by the root, per-story and per-world `opengraph-image` routes so every
 * shared link renders a branded 1200×630 card instead of a blank preview.
 * Relies on `next/og`'s built-in font, so no font assets need bundling.
 */

export const ogSize = { width: 1200, height: 630 }
export const ogContentType = 'image/png'

interface OgImageOptions {
  eyebrow?: string
  title: string
  subtitle?: string
}

function clamp(text: string, max: number): string {
  const t = text.trim()
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…'
}

export function renderOgImage({ eyebrow, title, subtitle }: OgImageOptions): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #1c1407 100%)',
          color: '#fafafa',
          fontFamily: 'serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            letterSpacing: 10,
            color: '#d4a13a',
          }}
        >
          {(eyebrow ?? APP_CONFIG.site.name).toUpperCase()}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.05,
              color: '#f5d896',
            }}
          >
            {clamp(title, 90)}
          </div>
          {subtitle ? (
            <div
              style={{
                display: 'flex',
                fontSize: 34,
                lineHeight: 1.3,
                color: 'rgba(250,250,250,0.62)',
                maxWidth: 980,
              }}
            >
              {clamp(subtitle, 150)}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 26,
            color: 'rgba(250,250,250,0.45)',
          }}
        >
          {APP_CONFIG.site.name} · Community CYOA
        </div>
      </div>
    ),
    { ...ogSize },
  )
}
