export const STORY_TAGS = [
  // Core genres
  'Fantasy', 'Dark Fantasy', 'Urban Fantasy', 'Fairy Tale', 'Mythology',
  'Horror', 'Gothic', 'Cosmic Horror', 'Supernatural',
  'Sci-Fi', 'Space Opera', 'Cyberpunk', 'Biopunk', 'Solarpunk',
  'Mystery', 'Noir', 'Thriller', 'Psychological',
  // Adventure & tone
  'Adventure', 'Survival', 'Action', 'Political',
  'Romance', 'Comedy', 'Slice of Life', 'Drama',
  // Setting
  'Historical', 'Alternate History', 'Post-Apocalyptic', 'Steampunk', 'Western',
  // Mechanics & style
  'LitRPG', 'Magical Realism',
] as const
export type StoryTag = typeof STORY_TAGS[number]


// ─── Content Ratings (worlds) ───────────────────────────────────────────────
export const CONTENT_RATINGS = ['Everyone', 'Teen', 'Mature'] as const
export type ContentRating = typeof CONTENT_RATINGS[number]

export const CONTENT_RATING_META: Record<
  ContentRating,
  { abbr: string; description: string; className: string }
> = {
  Everyone: {
    abbr: 'E',
    description: 'Suitable for all ages. No graphic content.',
    className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  },
  Teen: {
    abbr: 'T',
    description: 'Mild language, violence, or themes. Roughly 13+.',
    className: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  },
  Mature: {
    abbr: 'M',
    description: 'Strong language, violence, or mature themes. 17+.',
    className: 'text-red-400 bg-red-500/10 border-red-500/25',
  },
}

export const DEFAULT_CONTENT_RATING: ContentRating = 'Everyone'

