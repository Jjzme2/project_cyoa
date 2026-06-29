import { put } from '@vercel/blob'
import { IMAGE_MODEL } from './shared'
import { buildImagePrompt, type WorldContext } from './prompts'

export async function generateStoryImage(
  world: WorldContext,
  storyContent: string,
  choiceText: string,
  nodeId: string,
  userApiKey?: string,
): Promise<{ url: string | null; error?: string }> {
  // If the user's API key is a Google Gemini key, we should NOT use it for OpenRouter image generation.
  // We should fall back to our system OpenRouter key instead.
  const isGeminiKey = userApiKey?.startsWith('AIzaSy')
  const apiKey = (userApiKey && !isGeminiKey) ? userApiKey : process.env.OPENROUTER_API_KEY
  if (!apiKey) return { url: null, error: 'No OpenRouter API key configured on server.' }

  const prompt = buildImagePrompt(world, storyContent, choiceText)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message ?? `Image generation failed (${res.status})`)
    }

    const data = await res.json()
    const imageUrl: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url
    if (!imageUrl) return { url: null, error: 'OpenRouter response did not contain an image URL.' }

    // Fetch and re-upload to Vercel Blob so we control the URL lifetime
    const imgRes = await fetch(imageUrl)
    const blob = await imgRes.blob()
    const { url } = await put(`story-images/${nodeId}.webp`, blob, {
      access: 'public',
      contentType: 'image/webp',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return { url }
  } catch (error) {
    console.error('[generateStoryImage] Failed to generate/upload image:', error)
    return { url: null, error: error instanceof Error ? error.message : 'Unknown image generation error' }
  }
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

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message ?? `Image generation failed (${res.status})`)
    }

    const data = await res.json()
    const imageUrl: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url
    if (!imageUrl) return { url: null, error: 'OpenRouter response did not contain an image URL.' }

    const imgRes = await fetch(imageUrl)
    const blob = await imgRes.blob()
    const { url } = await put(`character-portraits/${blobKey}.webp`, blob, {
      access: 'public',
      contentType: 'image/webp',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return { url }
  } catch (error) {
    console.error('[generatePortraitImage] Failed to generate/upload image:', error)
    return { url: null, error: error instanceof Error ? error.message : 'Unknown image generation error' }
  }
}

export async function generateCoverImage(
  title: string,
  description: string,
  tags: string[],
  worldName: string,
  worldDescription: string,
  blobKey: string,
): Promise<{ url: string | null; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { url: null, error: 'No OpenRouter API key configured on server.' }

  const tagLine = tags.length > 0 ? `Genres: ${tags.join(', ')}. ` : ''
  const prompt = `Epic book cover illustration for a choose-your-own-adventure story. Title: "${title}". ${description ? `Premise: "${description}". ` : ''}${tagLine}${worldName ? `World: "${worldName}" — ${worldDescription.slice(0, 150)}. ` : ''}Dramatic composition, detailed fantasy art, painterly style, cinematic lighting. Portrait orientation, no text, no letters, no words anywhere in the image. Professional book cover art.`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message ?? `Image generation failed (${res.status})`)
    }

    const data = await res.json()
    const imageUrl: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url
    if (!imageUrl) return { url: null, error: 'OpenRouter response did not contain an image URL.' }

    const imgRes = await fetch(imageUrl)
    const blob = await imgRes.blob()
    const { url } = await put(`cover-images/${blobKey}.webp`, blob, {
      access: 'public',
      contentType: 'image/webp',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return { url }
  } catch (error) {
    console.error('[generateCoverImage] Failed to generate/upload image:', error)
    return { url: null, error: error instanceof Error ? error.message : 'Unknown image generation error' }
  }
}

