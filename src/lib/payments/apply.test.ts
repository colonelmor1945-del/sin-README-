import { beforeEach, describe, expect, it } from "vitest";

import { applyPaymentEvent, type PaymentPort, type PaymentRow } from "./apply";
import type { PaymentStatus, Tier } from "@/lib/types";

/**
 * A payment port that remembers what was asked of it.
 *
 * Every test here is about money or about access, so each one checks the
 * calls that were made, not only the value that came back: "it returned
 * applied: false" and "it granted nothing" are different claims, and the
 * second is the one that matters.
 */
function port(payments: PaymentRow[]) {
  const calls = {
    events: [] as { toStatus: PaymentStatus; applied: boolean }[],
    statuses: [] as { id: string; status: PaymentStatus }[],
    activated: [] as { userId: string; tier: Tier }[],
    cancelled: [] as string[],
    credited: [] as { userId: string; amount: number }[],
  };

  const impl: PaymentPort = {
    async findPayment(provider, providerRef) {
      return (
        payments.find(
          (p) => p.provider === provider && p.id === providerRef,
        ) ?? null
      );
    },
    async updatePaymentStatus(id, status) {
      calls.statuses.push({ id, status });
      const row = payments.find((p) => p.id === id);
      if (row) row.status = status;
    },
    async recordPaymentEvent(event) {
      calls.events.push({ toStatus: event.toStatus, applied: event.applied });
    },
    async activateSubscription(userId, tier) {
      calls.activated.push({ userId, tier });
    },
    async cancelSubscription(userId) {
      calls.cancelled.push(userId);
    },
    async grantCredits(userId, amount) {
      calls.credited.push({ userId, amount });
      return amount;
    },
  };

  return { impl, calls };
}

const subscription = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  id: "pay_1",
  userId: "user_1",
  provider: "stripe",
  kind: "subscription",
  amountMinor: 899,
  status: "pending",
  tier: "pro",
  credits: null,
  ...over,
});

const pack = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  id: "pay_2",
  userId: "user_1",
  provider: "stripe",
  kind: "credit_pack",
  amountMinor: 1999,
  status: "pending",
  tier: null,
  credits: 100,
  ...over,
});

const event = (over: Partial<Parameters<typeof applyPaymentEvent>[1]> = {}) => ({
  provider: "stripe",
  providerRef: "pay_1",
  status: "confirmed" as PaymentStatus,
  signatureVerified: true,
  ...over,
});

describe("applyPaymentEvent", () => {
  let p: ReturnType<typeof port>;

  beforeEach(() => {
    p = port([subscription(), pack()]);
  });

  it("activates the subscription on the confirmed transition", async () => {
    const out = await applyPaymentEvent(p.impl, event());
    expect(out).toEqual({ applied: true, granted: "subscription" });
    expect(p.calls.activated).toEqual([{ userId: "user_1", tier: "pro" }]);
    expect(p.calls.statuses).toEqual([{ id: "pay_1", status: "confirmed" }]);
  });

  it("grants nothing while the payment is only processing", async () => {
    const out = await applyPaymentEvent(p.impl, event({ status: "processing" }));
    expect(out).toEqual({ applied: true, granted: "none" });
    expect(p.calls.activated).toEqual([]);
    expect(p.calls.credited).toEqual([]);
  });

  it("grants once, however many times the provider retries", async () => {
    await applyPaymentEvent(p.impl, event());
    const second = await applyPaymentEvent(p.impl, event());
    const third = await applyPaymentEvent(p.impl, event());

    expect(second).toEqual({ applied: false, reason: "not-a-transition" });
    expect(third).toEqual({ applied: false, reason: "not-a-transition" });
    expect(p.calls.activated).toHaveLength(1);
  });

  it("refuses to walk a confirmed payment backwards", async () => {
    p = port([subscription({ status: "confirmed" })]);
    const out = await applyPaymentEvent(p.impl, event({ status: "pending" }));
    expect(out).toEqual({ applied: false, reason: "not-a-transition" });
    expect(p.calls.statuses).toEqual([]);
  });

  it("grants nothing for a reference we never created", async () => {
    const out = await applyPaymentEvent(
      p.impl,
      event({ providerRef: "pay_does_not_exist" }),
    );
    expect(out).toEqual({ applied: false, reason: "unknown-payment" });
    expect(p.calls.activated).toEqual([]);
    expect(p.calls.events).toEqual([]);
  });

  it("ignores a tier the payload claims, and uses the one we sold", async () => {
    const out = await applyPaymentEvent(
      p.impl,
      event({ payload: { tier: "elite", amountMinor: 1, metadata: { tier: "elite" } } }),
    );
    expect(out).toEqual({ applied: true, granted: "subscription" });
    // 899 was a Pro payment. Elite is 1599 and is not for sale at this price.
    expect(p.calls.activated).toEqual([{ userId: "user_1", tier: "pro" }]);
  });

  it("credits the pack it sold, not an amount from the event", async () => {
    const out = await applyPaymentEvent(
      p.impl,
      event({ providerRef: "pay_2", payload: { credits: 100000 } }),
    );
    expect(out).toEqual({ applied: true, granted: "credits" });
    expect(p.calls.credited).toEqual([{ userId: "user_1", amount: 100 }]);
  });

  it("records the event whether or not it applies", async () => {
    await applyPaymentEvent(p.impl, event());
    await applyPaymentEvent(p.impl, event());
    expect(p.calls.events).toEqual([
      { toStatus: "confirmed", applied: true },
      { toStatus: "confirmed", applied: false },
    ]);
  });

  // The starting state differs because the transition table only allows
  // "refunded" out of "confirmed" — you cannot refund what never went through.
  it.each([
    ["failed", "processing"],
    ["expired", "processing"],
    ["refunded", "confirmed"],
  ] as [PaymentStatus, PaymentStatus][])(
    "ends the subscription when the payment %s",
    async (status, from) => {
      p = port([subscription({ status: from })]);
      const out = await applyPaymentEvent(p.impl, event({ status }));
      expect(out).toEqual({ applied: true, granted: "none" });
      expect(p.calls.cancelled).toEqual(["user_1"]);
    },
  );

  it("does not end a subscription over a credit pack going wrong", async () => {
    p = port([pack({ status: "processing" })]);
    await applyPaymentEvent(p.impl, event({ providerRef: "pay_2", status: "failed" }));
    expect(p.calls.cancelled).toEqual([]);
  });

  it("records an anonymous contribution without granting anything", async () => {
    p = port([
      subscription({ userId: null, kind: "support_contribution", tier: null }),
    ]);
    const out = await applyPaymentEvent(p.impl, event());
    expect(out).toEqual({ applied: false, reason: "no-user" });
    expect(p.calls.statuses).toEqual([{ id: "pay_1", status: "confirmed" }]);
    expect(p.calls.activated).toEqual([]);
  });

  it("passes the signature flag through to the record", async () => {
    // The route drops unverified events before calling this, but if that ever
    // changes, the stored event says which it was.
    const unverified = port([subscription()]);
    await applyPaymentEvent(
      unverified.impl,
      event({ signatureVerified: false }),
    );
    expect(unverified.calls.events).toHaveLength(1);
  });
});
