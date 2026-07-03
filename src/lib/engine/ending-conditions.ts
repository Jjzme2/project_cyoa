import type { EndingCondition } from '@/types'

type ResourceMap = Record<string, number | string | string[] | number[]>

/**
 * The first author win/lose condition met by the current resources, or null.
 * Pure. Unlike the choice-requirement evaluator, an UNDEFINED resource never
 * triggers an ending (a missing value isn't a satisfied threshold).
 */
export function metEndingCondition(
  conditions: EndingCondition[] | undefined,
  resources: ResourceMap | undefined,
): EndingCondition | null {
  if (!conditions?.length || !resources) return null
  for (const c of conditions) {
    const val = resources[c.resourceName]
    if (val === undefined) continue
    if (compare(val, c.operator, c.value)) return c
  }
  return null
}

function compare(
  val: number | string | string[] | number[],
  op: EndingCondition['operator'],
  target: number | string,
): boolean {
  if (Array.isArray(val)) {
    const item = String(target).trim().toLowerCase()
    const has = val.map((v) => String(v).trim().toLowerCase()).includes(item)
    if (op === 'contains') return has
    if (op === 'not_contains') return !has
    return false
  }
  if (typeof val === 'number') {
    const t = Number(target)
    if (Number.isNaN(t)) return false
    switch (op) {
      case '>': return val > t
      case '<': return val < t
      case '>=': return val >= t
      case '<=': return val <= t
      case '==': return val === t
      case '!=': return val !== t
      default: return false
    }
  }
  // string
  const a = String(val).trim().toLowerCase()
  const b = String(target).trim().toLowerCase()
  if (op === '==') return a === b
  if (op === '!=') return a !== b
  return false
}
