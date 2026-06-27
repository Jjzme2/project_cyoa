/**
 * Barrel for the shared domain types. Definitions live in sibling modules by
 * domain; this file preserves the `@/types` import surface. Splitting only —
 * no type changed.
 */
export * from './content'
export * from './user'
export * from './characters'
export * from './rooms'
export * from './social'
export * from './story'
export * from './world'
export * from './themes'

// EngineState lives in ./engine but is surfaced via @/types for convenience.
export type { EngineState } from './engine'
