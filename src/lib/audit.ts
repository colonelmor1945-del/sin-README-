import "server-only";

/**
 * Audit trail for content changes.
 *
 * The `audit_log` table has been in the schema since the beginning and nothing
 * has ever written to it. That matters more here than it would elsewhere: two
 * people edit this dataset, every figure carries a claim about how much it can
 * be trusted, and "who moved this to Verified, and when" had no answer at all.
 *
 * Failures are swallowed on purpose. An audit row is a record of work that has
 * already happened — losing the write is bad, but refusing the edit because the
 * log was unavailable would be worse, and would turn a logging outage into an
 * editing outage.
 */

export type AuditAction =
  | "content.mission.update"
  | "content.asset.update"
  | "content.mission.import"
  | "content.asset.import"
  | "account.delete";

export async function recordAudit({
  actorId,
  action,
  subject,
  metadata = {},
}: {
  actorId: string | null;
  action: AuditAction;
  /** What was acted on: a record id, or a count for a bulk action. */
  subject: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  try {
    const { writeAudit } = await import("@/lib/content/postgres");
    await writeAudit(actorId, action, subject, metadata);
  } catch (error) {
    console.warn("[audit] write failed", action, subject, error);
  }
}
