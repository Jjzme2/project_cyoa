import { put } from '@vercel/blob'
import { runImageWaterfall } from './waterfall'
import { buildImagePrompt, type WorldContext } from './prompts'

async function generateAndUpload(
  prompt: string,
  apiKey: string,
  blobPath: string,
): Promise<{ url: string | null; error?: string }> {
  try {
    const { imageUrl } = await runImageWaterfall({ prompt, apiKey })

    // Fetch and re-upload to Vercel Blob so we control the URL lifetime
    const imgRes = await fetch(imageUrl)
    const blob = await imgRes.blob()
    const { url } = await put(blobPath, blob, {
      access: 'public',
      contentType: 'image/webp',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return { url }
  } catch (error) {
    console.error(`[generateAndUpload] Failed to generate/upload image (${blobPath}):`, error)
    return { url: null, error: error instanceof Error ? error.message : 'Unknown image generation error' }
  }
}

export async function generateStoryImage(
  world: WorldContext,
  storyContent: string,
  choiceText: string,
  nodeId: string,
): Promise<{ url: string | null; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { url: null, error: 'No OpenRouter API key configured on server.' }

  const prompt = buildImagePrompt(world, storyContent, choiceText)
  return generateAndUpload(prompt, apiKey, `story-images/${nodeId}.webp`)
}

export async function generatePortraitImage(
  name: string,
  tagline: string | undefined,
  description: string | undefined,
  blobKey: string,
): Promise<{ url: string | null; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { url: null, error: 'No OpenRouter API key configured on server.' }

  const desc = [tagline, description].filter((s) => s && s.trim()).join('. ').slice(0, 220)
  const prompt = `Character portrait illustration for a fantasy story. Subject: "${name}"${desc ? ` — ${desc}` : ''}. A SINGLE character, head-and-shoulders or upper-body portrait, centered, facing the viewer, with an expressive face. Painterly fantasy art, dramatic cinematic lighting, richly detailed. Portrait orientation, plain or softly atmospheric background. No text, no letters, no words anywhere in the image.`

  return generateAndUpload(prompt, apiKey, `character-portraits/${blobKey}.webp`)
}

export async function generateCoverImage(
  title: string,
  description: string,
  tags: string[],
  worldName: string,
  worldDescription: string,
  blobKey: string,
  directorNotes: string[] = [],
): Promise<{ url: string | null; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { url: null, error: 'No OpenRouter API key configured on server.' }

  const tagLine = tags.length > 0 ? `Genres: ${tags.join(', ')}. ` : ''
  const directorLine = directorNotes.length > 0 ? `Art direction: ${directorNotes.join(', ')}. ` : ''
  const prompt = `Epic book cover illustration for a choose-your-own-adventure story. Title: "${title}". ${description ? `Premise: "${description}". ` : ''}${tagLine}${worldName ? `World: "${worldName}" — ${worldDescription.slice(0, 150)}. ` : ''}${directorLine}Dramatic composition, detailed fantasy art, painterly style, cinematic lighting. Portrait orientation, no text, no letters, no words anywhere in the image. Professional book cover art.`

  return generateAndUpload(prompt, apiKey, `cover-images/${blobKey}.webp`)
}
