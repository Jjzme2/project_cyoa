import { APP_CONFIG } from '@/lib/config'
import { renderOgImage, ogSize, ogContentType } from '@/lib/og'

export const alt = APP_CONFIG.site.defaultTitle
export const size = ogSize
export const contentType = ogContentType

export default function Image() {
  return renderOgImage({
    eyebrow: APP_CONFIG.site.name,
    title: 'Every story, written together.',
    subtitle: 'A community choose-your-own-adventure library. Read a chapter, make a choice, write what happens next.',
  })
}
