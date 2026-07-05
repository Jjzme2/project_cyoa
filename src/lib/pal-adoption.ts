import { adminDb } from './firebase-admin'
import { CreditManager } from './credit-manager'
import { getUserAchievements } from './firestore-helpers'
import { isSpeciesUnlocked, PAL_ADOPTION_COST, type PetSpecies } from './pet'

// ─── Pal adoption — pals belong to a reader ───────────────────────────────────
//
// A reader OWNS their pals: the first is free, and every additional species is
// an adoption that costs purchased credits (the kind achievement rewards
// grant — earn achievements, adopt companions). Switching between pals you
// already own is free, like choosing which stuffed animal comes along today.
// Money-path rules apply: the debit is transactional and refunded if the
// adoption write fails.

/** The species this reader owns. Pre-ownership pals are grandfathered in:
 * an absent list means the current pal (default bird) is theirs. */
export function ownedSpeciesFrom(
  settings: FirebaseFirestore.DocumentData | undefined,
  currentSpecies: PetSpecies,
): PetSpecies[] {
  const stored = settings?.petOwnedSpecies
  const owned: PetSpecies[] = Array.isArray(stored) && stored.length > 0 ? [...stored] : []
  if (!owned.includes(currentSpecies)) owned.unshift(currentSpecies)
  return owned
}

export type AdoptResult =
  | { ok: true; adopted: boolean }
  | { ok: false; status: number; error: string }

/**
 * Switch to an owned pal (free), or adopt a new one (achievement gate first,
 * then the credit price). All checks server-side; the client's owned list is
 * display-only.
 */
export async function adoptOrSwitchPal(uid: string, species: PetSpecies): Promise<AdoptResult> {
  const achievements = await getUserAchievements(uid)
  if (!isSpeciesUnlocked(species, achievements.earned)) {
    return { ok: false, status: 403, error: 'That companion hasn’t been unlocked yet.' }
  }

  const ref = adminDb.collection('userSettings').doc(uid)
  const doc = await ref.get()
  const settings = doc.data()
  const current = (settings?.petSpecies as PetSpecies | undefined) ?? 'bird'
  const owned = ownedSpeciesFrom(settings, current)

  if (owned.includes(species)) {
    // Already one of theirs — bringing a different pal along is always free.
    await ref.set({ petSpecies: species, petOwnedSpecies: owned }, { merge: true })
    return { ok: true, adopted: false }
  }

  const held = await CreditManager.holdPurchased(uid, PAL_ADOPTION_COST)
  if (!held) {
    return {
      ok: false,
      status: 402,
      error: `Adopting a new pal costs ${PAL_ADOPTION_COST} credits — earn more through achievements or top up.`,
    }
  }
  try {
    await ref.set({ petSpecies: species, petOwnedSpecies: [...owned, species] }, { merge: true })
  } catch {
    await CreditManager.grantCredits(uid, PAL_ADOPTION_COST) // refund the hold
    return { ok: false, status: 500, error: 'Could not complete the adoption — your credits were refunded.' }
  }
  return { ok: true, adopted: true }
}
