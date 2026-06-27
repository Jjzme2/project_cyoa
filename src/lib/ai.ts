/**
 * Barrel for the AI layer. Implementation is split by responsibility under
 * `./ai/`: prompt construction (`prompts`), model config + response parsing
 * (`shared`), and the generators (`images`, `content`, `review`). This file
 * preserves the original `@/lib/ai` public surface.
 */
export { PromptRejectedError } from './ai/shared'
export { generateStoryImage, generateCoverImage } from './ai/images'
export {
  generateWorldFromPrompt,
  generateStoryFromPrompt,
  generateSagaOpening,
  generateStoryNode,
  elaborateWorldBible,
} from './ai/content'
export { reviewContribution, judgeContent, type ContributionReview, type ContentJudgment } from './ai/review'
