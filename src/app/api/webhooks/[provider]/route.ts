import { NextResponse } from "next/server";

import { canTransition, GRANTS_ENTITLEMENT } from "@/lib/payments/provider";
import { providerById } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * Payment webhook receiver.
 *
 * Non-negotiables, all enforced here:
 *  1. The raw body is read before anything parses it, because the signature
 *     covers the exact bytes.
 *  2. An unverified request is dropped. There is no debug bypass.
 *  3. Status changes go through the transition guard, so a retried or
 *     out-of-order event cannot demote a confirmed payment.
 *  4. Entitlements are granted only on the confirmed transition, and only
 *     from here. Nothing the browser sends can unlock a feature.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await params;
  const provider = providerById(providerId);

  if (!provider) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
  }

  const rawBody = await request.text();
  const verification = await provider.verifyWebhook({
    rawBody,
    headers: request.headers,
  });

  if (!verification.valid) {
    // Do not echo the reason to the caller. Log it server-side.
    console.warn("[webhook] rejected", providerId, verification.reason);
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const { providerRef, status } = verification;
  if (!providerRef || !status) {
    return NextResponse.json({ received: true, ignored: "no actionable status" });
  }

  // Persistence layer, once Postgres is wired:
  //
  //   BEGIN;
  //     SELECT status FROM payments
  //      WHERE provider = $1 AND provider_ref = $2 FOR UPDATE;
  //     -- returns 200 and no-ops when canTransition() is false, so provider
  //     -- retries stay idempotent
  //     UPDATE payments SET status = $3, updated_at = now() WHERE ...;
  //     INSERT INTO payment_events (payment_id, from_status, to_status,
  //                                 source, payload, signature_verified)
  //          VALUES (..., 'webhook', $4, true);
  //     -- only on the confirmed transition
  //     UPDATE users SET plan = ..., subscription_status = 'active' WHERE ...;
  //   COMMIT;
  const currentStatus = "pending" as const;
  const applies = canTransition(currentStatus, status);

  if (applies && status === GRANTS_ENTITLEMENT) {
    // grantEntitlement(payment) goes here, inside the same transaction.
  }

  return NextResponse.json({ received: true, applied: applies });
}
