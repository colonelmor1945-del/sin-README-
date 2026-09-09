import "server-only";

import crypto from "node:crypto";

import type {
  PaymentProvider,
  WebhookVerification,
} from "@/lib/payments/provider";

/**
 * Provider registry.
 *
 * Both providers are declared but unconfigured until their environment
 * variables are set. An unconfigured provider throws on createIntent rather
 * than pretending to work, so a missing key fails loudly in staging instead
 * of silently in production.
 */

/** Constant-time comparison. Never use === on a signature. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const WEBHOOK_TOLERANCE_SECONDS = 300;

/** Card and subscription payments. */
export const cardProvider: PaymentProvider = {
  id: "stripe",
  label: "Card payments",
  configured: Boolean(process.env.STRIPE_SECRET_KEY),

  async createIntent() {
    throw new Error(
      "Card provider is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, then implement createIntent against the Stripe SDK.",
    );
  },

  async verifyWebhook({ rawBody, headers }): Promise<WebhookVerification> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const header = headers.get("stripe-signature");
    if (!secret || !header) return { valid: false, reason: "missing signature or secret" };

    // Stripe sends "t=<unix>,v1=<hex>". Reject stale timestamps to stop replay.
    const parts = Object.fromEntries(
      header.split(",").map((p) => p.split("=") as [string, string]),
    );
    const timestamp = Number(parts.t);
    if (!Number.isFinite(timestamp)) return { valid: false, reason: "bad timestamp" };
    if (Math.abs(Date.now() / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
      return { valid: false, reason: "timestamp outside tolerance" };
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${parts.t}.${rawBody}`)
      .digest("hex");

    if (!parts.v1 || !safeEqual(expected, parts.v1)) {
      return { valid: false, reason: "signature mismatch" };
    }

    const payload = JSON.parse(rawBody);
    return { valid: true, providerRef: payload?.data?.object?.id, payload };
  },
};

/**
 * Crypto contributions. Designed against a self-hosted processor such as
 * BTCPay Server, which is why the verification is a plain HMAC over the raw
 * body rather than a vendor SDK call.
 *
 * Legal posture, deliberately: contributions are recorded with amounts,
 * timestamps and provider references so they can be reported as income. The
 * system does not offer anonymity and does not obscure the recipient.
 */
export const cryptoProvider: PaymentProvider = {
  id: "btcpay",
  label: "Crypto contributions",
  configured: Boolean(process.env.BTCPAY_URL && process.env.BTCPAY_API_KEY),

  async createIntent() {
    throw new Error(
      "Crypto provider is not configured. Set BTCPAY_URL, BTCPAY_STORE_ID, BTCPAY_API_KEY and BTCPAY_WEBHOOK_SECRET, then implement createIntent against the processor API.",
    );
  },

  async verifyWebhook({ rawBody, headers }): Promise<WebhookVerification> {
    const secret = process.env.BTCPAY_WEBHOOK_SECRET;
    const signature = headers.get("btcpay-sig");
    if (!secret || !signature) return { valid: false, reason: "missing signature or secret" };

    const expected =
      "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!safeEqual(expected, signature)) {
      return { valid: false, reason: "signature mismatch" };
    }

    const payload = JSON.parse(rawBody);
    const status =
      payload?.type === "InvoiceSettled"
        ? ("confirmed" as const)
        : payload?.type === "InvoiceExpired"
          ? ("expired" as const)
          : payload?.type === "InvoiceInvalid"
            ? ("failed" as const)
            : ("processing" as const);

    return { valid: true, providerRef: payload?.invoiceId, status, payload };
  },
};

export const PROVIDERS = [cardProvider, cryptoProvider];

export function providerById(id: string): PaymentProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Supporter tiers, by cumulative contribution in euro cents. */
export function supporterLevelFor(totalMinor: number) {
  if (totalMinor >= 5000) return "founding-supporter" as const;
  if (totalMinor >= 2500) return "early-supporter" as const;
  return "supporter" as const;
}
