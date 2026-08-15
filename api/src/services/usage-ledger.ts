import { sql } from "../db/client.js";
import { createRecordId } from "../db/id.js";

export class UsageLimitError extends Error {
  constructor(
    public required: number,
    public remaining: number,
  ) {
    super("Monthly usage limit exceeded");
    this.name = "UsageLimitError";
  }
}

export type UsageReservation = {
  key: string;
  credits: number;
};

/** Reserve credits under a per-user advisory lock. This closes the race where
 * simultaneous scan requests both observe the same remaining balance. */
export async function reserveModelUsage(input: {
  userId: string;
  modelId: string;
  scanId: string;
  credits: number;
  limit: number | null;
  modality: string;
  key?: string;
}): Promise<UsageReservation> {
  const credits = finiteCredits(input.credits);
  const key = input.key ?? `usage:${createRecordId()}`;
  await sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext(${'usage:' + input.userId}))`;
    const existing = await transaction<{ credits: number | string }[]>`
      SELECT credits FROM model_usage_ledger WHERE idempotency_key = ${key} LIMIT 1
    `;
    if (existing[0]) return;

    const totals = await transaction<{ used: number | string }[]>`
      SELECT COALESCE(sum(credits), 0) AS used
      FROM model_usage_ledger
      WHERE user_id = ${input.userId}
        AND occurred_at >= date_trunc('month', now())
    `;
    const used = Number(totals[0]?.used ?? 0);
    if (input.limit !== null && used + credits > input.limit) {
      throw new UsageLimitError(credits, Math.max(0, input.limit - used));
    }
    await transaction`
      INSERT INTO model_usage_ledger (
        id, user_id, model_id, scan_id, kind, credits, idempotency_key, metadata
      ) VALUES (
        ${createRecordId()}, ${input.userId}, ${input.modelId}, ${input.scanId},
        'charge', ${credits}, ${key},
        ${transaction.json({ modality: input.modality })}
      )
    `;
  });
  return { key, credits };
}

export async function refundModelUsage(
  reservationKey: string | undefined,
  reason: string,
): Promise<void> {
  if (!reservationKey) return;
  await sql.begin(async (transaction) => {
    const rows = await transaction<{
      user_id: string;
      model_id: string | null;
      scan_id: string | null;
      credits: number | string;
      metadata: Record<string, unknown> | null;
    }[]>`
      SELECT user_id, model_id, scan_id, credits, metadata
      FROM model_usage_ledger
      WHERE idempotency_key = ${reservationKey} AND kind = 'charge'
      LIMIT 1
    `;
    const charge = rows[0];
    if (!charge) return;
    await transaction`
      INSERT INTO model_usage_ledger (
        id, user_id, model_id, scan_id, kind, credits, idempotency_key, metadata
      ) VALUES (
        ${createRecordId()}, ${charge.user_id}, ${charge.model_id}, ${charge.scan_id},
        'refund', ${-Math.abs(Number(charge.credits))}, ${reservationKey + ':refund'},
        ${transaction.json({ ...(charge.metadata ?? {}), reason })}
      )
      ON CONFLICT (idempotency_key) DO NOTHING
    `;
  });
}

function finiteCredits(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error("Usage credits must be non-negative");
  return Math.round(value * 10_000) / 10_000;
}
