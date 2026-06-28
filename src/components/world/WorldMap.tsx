'use client'

import { useMemo } from 'react'
import { layoutRegions, regionLinks } from '@/lib/world-map'
import type { WorldBible } from '@/types'

/** Keyword → fill. Biome strings are free-text from genesis, so match loosely. */
const BIOME_COLORS: { match: RegExp; color: string }[] = [
  { match: /ocean|sea|coast|water|lake|river/i, color: '#3b82f6' },
  { match: /mountain|peak|highland|crag|cliff/i, color: '#a8a29e' },
  { match: /desert|dune|waste|arid|sand/i, color: '#d9a441' },
  { match: /forest|wood|jungle|grove/i, color: '#3f9a52' },
  { match: /swamp|marsh|fen|bog|mire/i, color: '#5b7c4a' },
  { match: /snow|ice|tundra|frozen|glaci/i, color: '#bcd4e6' },
  { match: /volcan|ash|ember|magma|scorch/i, color: '#e25b3a' },
  { match: /plain|field|grass|meadow|steppe/i, color: '#9bbb59' },
  { match: /city|capital|ruin|citadel|spire/i, color: '#c084fc' },
]

function biomeColor(biome: string): string {
  return BIOME_COLORS.find((b) => b.match.test(biome))?.color ?? '#8b8b9e'
}

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()

export function WorldMap({
  bible,
  seed = 0,
  currentLocation,
  visited,
  className,
}: {
  bible?: WorldBible
  seed?: number
  currentLocation?: string | null
  visited?: string[]
  className?: string
}) {
  const regions = useMemo(() => layoutRegions(bible?.regions, seed), [bible?.regions, seed])
  const links = useMemo(() => regionLinks(bible), [bible])
  const pos = useMemo(() => new Map(regions.map((r) => [r.name, r])), [regions])
  const visitedSet = useMemo(() => new Set((visited ?? []).map(norm)), [visited])

  if (regions.length === 0) return null

  const current = norm(currentLocation)

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="World map" preserveAspectRatio="xMidYMid meet">
      {/* Faction roads / contested borders */}
      {links.map((l, i) => {
        const a = pos.get(l.from)
        const b = pos.get(l.to)
        if (!a || !b) return null
        return (
          <line
            key={i}
            x1={a.x * 100}
            y1={a.y * 100}
            x2={b.x * 100}
            y2={b.y * 100}
            stroke={l.kind === 'rival' ? '#ef4444' : '#fbbf24'}
            strokeWidth={0.4}
            strokeOpacity={0.25}
            strokeDasharray={l.kind === 'rival' ? '1.5 1.5' : undefined}
          />
        )
      })}

      {/* Regions */}
      {regions.map((r) => {
        const isCurrent = current !== '' && norm(r.name) === current
        const isVisited = visitedSet.has(norm(r.name))
        const fill = biomeColor(r.biome)
        return (
          <g key={r.name}>
            <title>{`${r.name} — ${r.biome}`}</title>
            {isCurrent && (
              <circle cx={r.x * 100} cy={r.y * 100} r={4.2} fill="none" stroke="#fbbf24" strokeWidth={0.6}>
                <animate attributeName="r" values="3.4;5;3.4" dur="2s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.9;0.2;0.9" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={r.x * 100}
              cy={r.y * 100}
              r={isCurrent ? 2.6 : 2}
              fill={fill}
              fillOpacity={isCurrent ? 1 : isVisited ? 0.92 : 0.5}
              stroke={isCurrent ? '#fde68a' : isVisited ? '#ffffff' : '#000000'}
              strokeOpacity={isCurrent ? 1 : isVisited ? 0.5 : 0.25}
              strokeWidth={0.4}
            />
            <text
              x={r.x * 100}
              y={r.y * 100 - 3.2}
              textAnchor="middle"
              fontSize={2.6}
              fill={isCurrent ? '#fde68a' : '#e7e3d8'}
              fillOpacity={isCurrent || isVisited ? 0.95 : 0.55}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {r.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
