import type { DocumentData } from 'firebase-admin/firestore'

// ─── Roles & Access Control ─────────────────────────────────────────────────
export type Role = 'user' | 'admin'

export interface FirebaseUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  tier: 'FREE' | 'PREMIUM'
}

export class UserProfile {
  public readonly uid: string
  public readonly email: string | null
  public readonly displayName: string | null
  public readonly photoURL: string | null
  public readonly tier: 'FREE' | 'PREMIUM'
  public readonly stripeCustomerId: string | null
  public readonly stripeSubscriptionId: string | null
  public readonly subscriptionStatus: string | null
  public readonly subscriptionPeriodEnd: string | null
  public readonly purchasedCredits: number
  public readonly lifetimeCreditsPurchased: number
  public readonly createdAt: string
  public readonly dateOfBirth: string | null

  constructor(
    uid: string,
    email: string | null,
    displayName: string | null,
    photoURL: string | null,
    tier: 'FREE' | 'PREMIUM' = 'FREE',
    stripeCustomerId: string | null = null,
    stripeSubscriptionId: string | null = null,
    subscriptionStatus: string | null = null,
    subscriptionPeriodEnd: string | null = null,
    purchasedCredits = 0,
    lifetimeCreditsPurchased = 0,
    createdAt: string = new Date().toISOString(),
    dateOfBirth: string | null = null
  ) {
    this.uid = uid
    this.email = email
    this.displayName = displayName
    this.photoURL = photoURL
    this.tier = tier
    this.stripeCustomerId = stripeCustomerId
    this.stripeSubscriptionId = stripeSubscriptionId
    this.subscriptionStatus = subscriptionStatus
    this.subscriptionPeriodEnd = subscriptionPeriodEnd
    this.purchasedCredits = purchasedCredits
    this.lifetimeCreditsPurchased = lifetimeCreditsPurchased
    this.createdAt = createdAt
    this.dateOfBirth = dateOfBirth
  }

  public static fromFirestore(uid: string, data: DocumentData): UserProfile {
    return new UserProfile(
      uid,
      data.email ?? null,
      data.displayName ?? null,
      data.photoURL ?? null,
      (data.tier as 'FREE' | 'PREMIUM') ?? 'FREE',
      data.stripeCustomerId ?? null,
      data.stripeSubscriptionId ?? null,
      data.subscriptionStatus ?? null,
      data.subscriptionPeriodEnd ?? null,
      data.purchasedCredits ?? 0,
      data.lifetimeCreditsPurchased ?? 0,
      data.createdAt ?? new Date().toISOString(),
      data.dateOfBirth ?? null
    )
  }

  public toFirestore(): Record<string, unknown> {
    return {
      email: this.email,
      displayName: this.displayName,
      photoURL: this.photoURL,
      tier: this.tier,
      stripeCustomerId: this.stripeCustomerId,
      stripeSubscriptionId: this.stripeSubscriptionId,
      subscriptionStatus: this.subscriptionStatus,
      subscriptionPeriodEnd: this.subscriptionPeriodEnd,
      purchasedCredits: this.purchasedCredits,
      lifetimeCreditsPurchased: this.lifetimeCreditsPurchased,
      createdAt: this.createdAt,
      dateOfBirth: this.dateOfBirth,
      updatedAt: new Date().toISOString()
    }
  }
}
