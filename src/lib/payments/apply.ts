import "server-only";

import {
  GRANTS_ENTITLEMENT,
  canTransition,
  type PaymentKind,
} from "@/lib/payments/provider";
import type { PaymentStatus, Tier } from "@/lib/types";

/**
 * What a verified payment event is allowed to change.
 *
 * This module is the only place an entitlement is granted. The webhook route
 * verifies the signature and hands the result here; nothing else in the app
 * may flip a tier or add credits from a payment.
 *
 * THE RULES, AND WHY EACH ONE EXISTS
 *
 * 1. **The payment must already exist.** We record a row when we create the
 *    intent, so a confirmed event for a reference we have never seen is not a
 *    sale — it is a forged or misrouted event, and it grants nothing. (A valid
 *    signature proves the message came from the provider, not that it is about
 *    one of our payments.)
 *
 * 2. **The tier comes from our row, never from the event.** The amount and the
 *    plan were decided when we created the intent. A payload claiming
 *    `tier: "elite"` on a 99-cent payment is ignored, because we do not read
 *    it. This is the same principle as the session cookie never carrying a
 *    role.
 *
 * 3. **Transitions are one-way and guarded.** Providers retry, duplicate and
 *    deliver out of order. `canTransition` refuses to move a confirmed payment
 *    backwards, and a repeat of the same status is a no-op rather than a
 *    second grant. That is what makes this idempotent, which matters because
 *    the alternative is charging once and granting twice.
 *
 * 4. **Every event is recorded, applied or not.** A rejected or unmatched
 *    event is exactly what somebody will need to look at during a dispute.
 */

/** The slice of storage this logic needs. Keeps it testable without a database. */
export interface PaymentPort {
  findPayment(
    provider: string,
    providerRef: string,
  ): Promise<PaymentRow | null>;
  updatePaymentStatus(id: string, status: PaymentStatus): Promise<void>;
  recordPaymentEvent(event: {
    paymentId: string;
    fromStatus: PaymentStatus;
    toStatus: PaymentStatus;
    source: string;
    signatureVerified: boolean;
    payload: unknown;
    applied: boolean;
  }): Promise<void>;
  /** Sets the tier and the subscription state together, or neither. */
  activateSubscription(userId: string, tier: Tier): Promise<void>;
  cancelSubscription(userId: string): Promise<void>;
  grantCredits(userId: string, amount: number, reason: "pack"): Promise<number>;
}

export interface PaymentRow {
  id: string;
  userId: string | null;
  provider: string;
  kind: PaymentKind;
  amountMinor: number;
  status: PaymentStatus;
  /** Set when the intent was created. The tier we sold, for a subscription. */
  tier: Tier | null;
  /** Set when the intent was created. The credits we sold, for a pack. */
  credits: number | null;
}

export type ApplyOutcome =
  | { applied: true; granted: "subscription" | "credits" | "none" }
  | {
      applied: false;
      reason: "unknown-payment" | "not-a-transition" | "no-user";
    };

export async function applyPaymentEvent(
  port: PaymentPort,
  event: {
    provider: string;
    providerRef: string;
    status: PaymentStatus;
    payload?: unknown;
    signatureVerified: boolean;
    source?: string;
  },
): Promise<ApplyOutcome> {
  const payment = await port.findPayment(event.provider, event.providerRef);

  // Rule 1. Nothing to attach this to, so nothing to grant. Not recorded
  // against a payment either, since the events table hangs off one — the
  // route logs it instead.
  if (!payment) return { applied: false, reason: "unknown-payment" };

  const from = payment.status;
  const to = event.status;
  const applies = canTransition(from, to);
  const source = event.source ?? "webhook";

  // Rule 4. The record is written whether or not the change goes through.
  await port.recordPaymentEvent({
    paymentId: payment.id,
    fromStatus: from,
    toStatus: to,
    source,
    signatureVerified: event.signatureVerified,
    payload: event.payload ?? {},
    applied: applies,
  });

  // Rule 3. A retry, a duplicate, or an attempt to walk a confirmed payment
  // backwards. Recorded above, then dropped.
  if (!applies) return { applied: false, reason: "not-a-transition" };

  await port.updatePaymentStatus(payment.id, to);

  // A contribution or an anonymous purchase has nobody to credit. The money is
  // still recorded; there is simply no account to change.
  if (!payment.userId) {
    return to === GRANTS_ENTITLEMENT
      ? { applied: false, reason: "no-user" }
      : { applied: true, granted: "none" };
  }

  if (to === GRANTS_ENTITLEMENT) {
    // Rule 2. Read from our own row, never from the payload.
    if (payment.kind === "subscription" && payment.tier) {
      await port.activateSubscription(payment.userId, payment.tier);
      return { applied: true, granted: "subscription" };
    }
    if (payment.kind === "credit_pack" && payment.credits) {
      await port.grantCredits(payment.userId, payment.credits, "pack");
      return { applied: true, granted: "credits" };
    }
    return { applied: true, granted: "none" };
  }

  // A subscription that fails, expires or is refunded stops being a
  // subscription. Credits already granted are not clawed back here: that is a
  // support decision with a human in it, not an automatic one.
  if (payment.kind === "subscription" && REVOKES.includes(to)) {
    await port.cancelSubscription(payment.userId);
  }

  return { applied: true, granted: "none" };
}

/** Statuses that end a subscription. "processing" deliberately does not. */
const REVOKES: PaymentStatus[] = ["failed", "expired", "refunded"];
