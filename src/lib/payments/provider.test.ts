import { describe, expect, it } from "vitest";

import { GRANTS_ENTITLEMENT, canTransition } from "@/lib/payments/provider";
import type { PaymentStatus } from "@/lib/types";

/**
 * Tests for the payment status machine.
 *
 * Providers retry webhooks and deliver them out of order. Without a guard, a
 * delayed "processing" event arriving after a "confirmed" one demotes a paid
 * customer to unpaid, and the first anyone hears about it is a support ticket.
 *
 * So these are mostly about what must *not* be allowed.
 */

const ALL: PaymentStatus[] = [
  "pending",
  "processing",
  "confirmed",
  "failed",
  "expired",
  "refunded",
];

describe("canTransition", () => {
  it("walks the normal path", () => {
    expect(canTransition("pending", "processing")).toBe(true);
    expect(canTransition("processing", "confirmed")).toBe(true);
  });

  it("allows a pending payment to confirm without an intermediate step", () => {
    // Some providers skip straight there, and refusing it would strand the
    // payment as pending forever.
    expect(canTransition("pending", "confirmed")).toBe(true);
  });

  it("never demotes a confirmed payment back to processing or pending", () => {
    // The out-of-order webhook case, and the reason this guard exists.
    expect(canTransition("confirmed", "processing")).toBe(false);
    expect(canTransition("confirmed", "pending")).toBe(false);
  });

  it("never marks a confirmed payment failed or expired", () => {
    expect(canTransition("confirmed", "failed")).toBe(false);
    expect(canTransition("confirmed", "expired")).toBe(false);
  });

  it("allows a confirmed payment to be refunded, and nothing else", () => {
    const allowed = ALL.filter((to) => canTransition("confirmed", to));
    expect(allowed).toEqual(["refunded"]);
  });

  it("treats failed, expired and refunded as final", () => {
    for (const terminal of ["failed", "expired", "refunded"] as const) {
      for (const to of ALL) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });

  it("rejects a transition to the same status", () => {
    // A duplicate webhook is a no-op, not a state change, and treating it as
    // one would write a second event row for something that did not happen.
    for (const status of ALL) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("never allows a cycle back into an earlier state", () => {
    // Exhaustive sweep: reaching a terminal state must be one way.
    const terminal: PaymentStatus[] = ["failed", "expired", "refunded"];
    for (const from of terminal) {
      for (const to of ALL) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });
});

describe("entitlement gate", () => {
  it("grants only on confirmed", () => {
    // Anything else here would mean a pending or processing payment unlocks a
    // paid feature, which is a free subscription for anyone who starts a
    // checkout and abandons it.
    expect(GRANTS_ENTITLEMENT).toBe("confirmed");
  });
});
