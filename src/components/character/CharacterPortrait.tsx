import Image from 'next/image'
import { monogram, nameAccent } from '@/lib/characters'

interface Props {
  name: string
  portraitUrl?: string
  size?: number
  className?: string
  rounded?: string
}

/**
 * A character's portrait — the generated image when one exists, otherwise a
 * stable monogram on a name-derived accent. Presentational; safe in server
 * components.
 */
export function CharacterPortrait({ name, portraitUrl, size = 64, className = '', rounded = 'rounded-xl' }: Props) {
  if (portraitUrl) {
    return (
      <div className={`relative overflow-hidden ${rounded} ${className}`} style={{ width: size, height: size }}>
        <Image src={portraitUrl} alt={name} fill className="object-cover" sizes={`${size}px`} />
      </div>
    )
  }
  return (
    <div
      className={`flex items-center justify-center font-bold text-white/90 ${rounded} ${className}`}
      style={{ width: size, height: size, background: nameAccent(name), fontSize: size * 0.36 }}
    >
      {monogram(name)}
    </div>
  )
}
