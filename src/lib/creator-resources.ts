import type { ChoiceRequirement, ChoiceEffect, ResourceDefinition } from '@/types'

/**
 * Creator Resource Manager
 * Business logic to evaluate gameplay conditions and apply effects
 * for custom variables, including lists/inventories and bounds checks.
 */
export class CreatorResourceManager {
  /**
   * Evaluates if a set of choice requirements are satisfied by the current resource state.
   */
  public static evaluateRequirements(
    requirements: ChoiceRequirement[] | undefined,
    currentRes: Record<string, number | string | string[] | number[]>
  ): boolean {
    if (!requirements || requirements.length === 0) return true

    return requirements.every((req) => {
      const val = currentRes[req.resourceName]
      if (val === undefined) return true

      // Handle array type resources (like Inventory)
      if (Array.isArray(val)) {
        const item = String(req.value).trim().toLowerCase()
        const lowerVal = val.map(v => String(v).trim().toLowerCase())
        if (req.operator === 'contains') {
          return lowerVal.includes(item)
        }
        if (req.operator === 'not_contains') {
          return !lowerVal.includes(item)
        }
        return false
      }

      // Handle numeric type resources
      if (typeof val === 'number') {
        const reqVal = Number(req.value)
        if (isNaN(reqVal)) return false

        switch (req.operator) {
          case '==': return val === reqVal
          case '!=': return val !== reqVal
          case '>': return val > reqVal
          case '<': return val < reqVal
          case '>=': return val >= reqVal
          case '<=': return val <= reqVal
          default: return true
        }
      }

      // Handle boolean type resources (stored as 'true'/'false' strings)
      if (val === 'true' || val === 'false') {
        const boolVal = val === 'true'
        const reqBool = String(req.value) === 'true'
        switch (req.operator) {
          case '==': return boolVal === reqBool
          case '!=': return boolVal !== reqBool
          default: return true
        }
      }

      // Handle string type resources
      const valStr = String(val).trim().toLowerCase()
      const reqValStr = String(req.value).trim().toLowerCase()
      switch (req.operator) {
        case '==': return valStr === reqValStr
        case '!=': return valStr !== reqValStr
        default: return true
      }
    })
  }

  /**
   * Applies choice effects to the current resource state.
   */
  public static applyEffects(
    effects: ChoiceEffect[] | undefined,
    currentRes: Record<string, number | string | string[] | number[]>,
    definitions?: ResourceDefinition[]
  ): Record<string, number | string | string[] | number[]> {
    const updated = { ...currentRes }
    if (!effects || effects.length === 0) return updated

    effects.forEach((eff) => {
      const def = definitions?.find((d) => d.name === eff.resourceName)
      const currentVal = updated[eff.resourceName]
      
      // If current value is not defined, initialize it
      const val = currentVal !== undefined ? currentVal : (def ? def.defaultValue : 0)

      if (Array.isArray(val) || def?.type === 'array') {
        const arr = Array.isArray(val) ? [...val] : []
        const item = String(eff.value).trim()
        
        if (eff.operator === 'add' || eff.operator === '+=') {
          if (!arr.map(x => String(x).toLowerCase()).includes(item.toLowerCase())) {
            arr.push(item)
          }
          updated[eff.resourceName] = arr as string[]
        } else if (eff.operator === 'remove' || eff.operator === '-=') {
          updated[eff.resourceName] = arr.filter(
            (i) => String(i).toLowerCase() !== item.toLowerCase()
          ) as string[]
        } else if (eff.operator === '=') {
          updated[eff.resourceName] = item
            .split(',')
            .map((i) => i.trim())
            .filter(Boolean) as string[]
        }
      } else if (typeof val === 'number' || def?.type === 'number') {
        const numVal = Number(val)
        const delta = Number(eff.value)
        if (isNaN(numVal) || isNaN(delta)) return

        let newVal = numVal
        if (eff.operator === '+=') {
          newVal = numVal + delta
        } else if (eff.operator === '-=') {
          newVal = numVal - delta
        } else if (eff.operator === '=') {
          newVal = delta
        }

        // Apply bounds checks if min/max are defined
        if (def) {
          if (def.min !== undefined && def.min !== null) {
            newVal = Math.max(def.min, newVal)
          }
          if (def.max !== undefined && def.max !== null) {
            newVal = Math.min(def.max, newVal)
          }
        }

        updated[eff.resourceName] = newVal
      } else if (def?.type === 'boolean' || val === 'true' || val === 'false') {
        if (eff.operator === '=') {
          updated[eff.resourceName] = eff.value === 'true' ? 'true' : 'false'
        }
      } else {
        // String fallback
        if (eff.operator === '=') {
          updated[eff.resourceName] = String(eff.value)
        }
      }
    })

    return updated
  }
}
