export interface ValidationResult {
  valid: boolean
  reason?: string
}

// Common profanity — whole-word match to avoid false positives
const PROFANITY_RE = /\b(fuck|shit|bitch|cunt|dick|cock|pussy|bastard|nigger|nigga|faggot|fag|slut|whore|rape|rapist|piss|asshole|asshat|motherfucker|dipshit)\b/i

// Patterns that signal 4th-wall breaks or out-of-universe requests
const META_RE = /\b(ignore (previous|prior|your) instructions?|as an? (ai|llm|language model|chatbot|assistant)|forget (everything|your)|you are actually|pretend (you are|to be)|jailbreak|prompt injection|system prompt)\b/i

export function validatePromptLocal(text: string): ValidationResult {
  const trimmed = text.trim()

  if (trimmed.length < 5) {
    return { valid: false, reason: 'Your path is too short — describe where it leads.' }
  }

  if (trimmed.length > 400) {
    return { valid: false, reason: 'Keep your choice under 400 characters.' }
  }

  if (PROFANITY_RE.test(trimmed)) {
    return { valid: false, reason: 'Prompt contains inappropriate language.' }
  }

  if (META_RE.test(trimmed)) {
    return { valid: false, reason: 'Stay within the story world.' }
  }

  return { valid: true }
}
