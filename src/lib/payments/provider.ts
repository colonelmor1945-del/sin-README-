import "server-only";

import type { PaymentStatus } from "@/lib/types";

/**
 * Payment provider abstraction.
 *
 * Three concerns are deliberately separated:
 *  - creating an intent (card, crypto, or a one-off contribution)
 *  - verifying an inbound webhook signature
 *  - translating a provider event into our own status enum
 *
 * Nothing in the app unlocks an entitlement from a client-supplied value. The
 * only thing that flips a payment to "confirmed" is a signature-verified
 * webhook or a server-side poll of the provider API.
 */

export type PaymentKind = "subscription" | "credit_pack" | "support_contribution";

export interface CreateIntentInput {
  kind: PaymentKind;
  /** Smallest currency unit. 499 is 4.99 EUR. */
  amountMinor: number;
  currency: "EUR" | "USD";
  userId: string | null;
  /** Caller-generated. Replaying the same key must not create a second charge. */
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntent {
  providerRef: string;
  status: PaymentStatus;
  /** Hosted checkout page, or a crypto invoice page. */
  redirectUrl?: string;
  /** Crypto only. Public receiving address or BOLT11 invoice. */
  destination?: string;
  asset?: string;
  network?: string;
  expiresAt?: string;
}

export interface WebhookVerification {
  valid: boolean;
  providerRef?: string;
  status?: PaymentStatus;
  /** Parsed payload, stored verbatim in payment_events for dispute handling. */
  payload?: unknown;
  reason?: string;
}

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  readonly configured: boolean;

  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;

  /**
   * Verifies the raw request body against the signature header. Must use a
   * constant-time comparison and must reject on a stale timestamp.
   */
  verifyWebhook(input: {
    rawBody: string;
    headers: Headers;
  }): Promise<WebhookVerification>;
}

/* Status machine --------------------------------------------------------- */

const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["processing", "confirmed", "failed", "expired"],
  processing: ["confirmed", "failed", "expired"],
  confirmed: ["refunded"],
  failed: [],
  expired: [],
  refunded: [],
};

/**
 * Guards against out-of-order webhooks. Providers retry, and a delayed
 * "processing" event must never demote an already-confirmed payment.
 */
export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

/** Entitlements are granted only on this transition, never earlier. */
export const GRANTS_ENTITLEMENT: PaymentStatus = "confirmed";
