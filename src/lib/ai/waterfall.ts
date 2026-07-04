import { generateText, APICallError } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

/**
 * Shared reliability waterfall for every AI call in the app: try a tier, and
 * if it fails for a reason other than billing/rate-limiting, fall through to
 * the next tier instead of failing the whole feature. Billing (402) and
 * rate-limit (429) errors are NOT retried down the waterfall — they mean
 * "the account needs attention" or "slow down", not "try a different model" —
 * so callers can keep surfacing those distinctly (fail open, user-facing
 * message, etc.) exactly as before.
 *
 * Tiers after the first are deliberately non-"preview"/non-experimental model
 * ids where possible — preview slugs get renamed or retired without notice,
 * which is what made the old single-model image path brittle.
 */

type TextTier = { model: string; via: 'gateway' } | { model: string; via: 'openrouter' }

export const TEXT_WATERFALL: TextTier[] = [
  { model: 'google/gemini-2.5-pro', via: 'gateway' },
  { model: 'google/gemini-2.5-flash', via: 'gateway' },
  { model: 'openai/gpt-4o-mini', via: 'openrouter' },
]

export const IMAGE_WATERFALL: string[] = [
  'google/gemini-2.5-flash-image-preview',
  'google/gemini-2.5-flash-image',
  'google/gemini-2.0-flash-exp:free',
]

/** True for errors that should short-circuit the waterfall (never worth retrying elsewhere). */
export function isBillingOrRateLimitError(error: unknown): boolean {
  return APICallError.isInstance(error) && (error.statusCode === 402 || error.statusCode === 429)
}

/**
 * Run a plain-text-completion prompt through the text waterfall, returning
 * the winning tier's raw text and a model label (for provenance/telemetry).
 * Throws the billing/rate-limit error immediately if the FIRST tier hits one
 * (matching prior behavior); otherwise throws the last tier's error once all
 * tiers are exhausted.
 */
export async function runTextWaterfall(opts: {
  prompt: string
  userId: string
  maxOutputTokens: number
  feature: string
}): Promise<{ text: string; model: string }> {
  const { prompt, userId, maxOutputTokens, feature } = opts
  let lastError: unknown

  for (const tier of TEXT_WATERFALL) {
    try {
      if (tier.via === 'gateway') {
        const result = await generateText({
          model: tier.model,
          prompt,
          maxOutputTokens,
          providerOptions: { gateway: { user: userId, tags: [`feature:${feature}`, 'env:production'] } },
        })
        return { text: result.text, model: tier.model }
      }
      if (!process.env.OPENROUTER_API_KEY) {
        lastError = new Error('No OPENROUTER_API_KEY configured on server.')
        continue
      }
      const openrouter = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY })
      const result = await generateText({ model: openrouter(tier.model), prompt, maxOutputTokens })
      return { text: result.text, model: `openrouter/${tier.model}` }
    } catch (error) {
      if (isBillingOrRateLimitError(error)) throw error
      console.error(`[ai-waterfall] text tier failed (${feature}): ${tier.model}`, error)
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All AI model tiers failed.')
}

/**
 * Run an image-generation prompt through the image waterfall via OpenRouter's
 * multimodal chat-completions endpoint. Returns the winning tier's image URL
 * and model label. Throws only once every tier has failed.
 */
export async function runImageWaterfall(opts: {
  prompt: string
  apiKey: string
}): Promise<{ imageUrl: string; model: string }> {
  let lastError: unknown

  for (const model of IMAGE_WATERFALL) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: opts.prompt }],
          modalities: ['image', 'text'],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message ?? `Image generation failed (${res.status}) for ${model}`)
      }

      const data = await res.json()
      const imageUrl: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url
      if (!imageUrl) throw new Error(`${model} returned no image URL.`)
      return { imageUrl, model }
    } catch (error) {
      console.error(`[ai-waterfall] image tier failed: ${model}`, error)
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All image model tiers failed.')
}
