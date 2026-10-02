import { sql, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { files } from '@/lib/db';
import { getPlanLimits } from '@/lib/plans';

/** Total bytes currently stored by an agency across all project files. */
export async function getAgencyStorageBytes(db: Db, agencyId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${files.size}), 0)` })
    .from(files)
    .where(eq(files.agencyId, agencyId));
  return Number(row?.total ?? 0);
}

function formatCap(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toLocaleString('de-DE')} GB` : `${mb} MB`;
}

/**
 * Throws a user-readable German error if adding `incomingBytes` would push the
 * agency over its plan's storage cap. Called server-side before any R2 write.
 */
export async function assertStorageAvailable(
  db: Db,
  agencyId: string,
  plan: string | null | undefined,
  incomingBytes: number,
): Promise<void> {
  const capMb = getPlanLimits(plan).storageMb;
  if (!Number.isFinite(capMb)) return; // unlimited (no current plan uses this, but future-proof)
  const capBytes = capMb * 1024 * 1024;
  const used = await getAgencyStorageBytes(db, agencyId);
  if (used + incomingBytes > capBytes) {
    throw new Error(`Speicher-Limit erreicht (${formatCap(capMb)}). Bitte Dateien löschen oder Tarif upgraden.`);
  }
}
