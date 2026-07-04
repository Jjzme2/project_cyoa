/**
 * Barrel for the AI layer. Implementation is split by responsibility under
 * `./ai/`: prompt construction (`prompts`), model config + response parsing
 * (`shared`), and the generators (`images`, `content`, `review`). This file
 * preserves the original `@/lib/ai` public surface.
 */
export { PromptRejectedError } from './ai/shared'
export { buildWorldContext, type WorldContextOptions } from './ai/world-context'
export { generateStoryImage, generateCoverImage, generatePortraitImage } from './ai/images'
export {
  generateWorldFromPrompt,
  generateStoryFromPrompt,
  generateSagaOpening,
  generateStoryNode,
  elaborateWorldBible,
  generateCustomNarrativeShape,
  classifyNarrativeMode,
  type ClassifiableNarrativeMode,
} from './ai/content'
export { reviewContribution, judgeContent, type ContributionReview, type ContentJudgment } from './ai/review'
export {
  generateAssistQuestions,
  generateAssistFields,
  WORLD_ASSIST_FIELDS,
  STORY_ASSIST_FIELDS,
  type AssistType,
  type AssistAnswer,
  type AssistWorldContext,
} from './ai/assist'
