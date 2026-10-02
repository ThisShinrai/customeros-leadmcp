import { auditLogs } from '@/lib/db';
import type { Db } from '@/lib/db';

export interface AuditEntry {
  agencyId: string;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: unknown;
}

/**
 * Append a row to the audit trail. Never throws into the caller: auditing is a
 * side-effect and must not break the surrounding business logic. Failures are
 * swallowed (best-effort logging).
 */
export async function logAudit(db: Db, entry: AuditEntry): Promise<void> {
  try {
    let meta: string | null = null;
    if (entry.meta !== undefined && entry.meta !== null) {
      try {
        meta = JSON.stringify(entry.meta);
      } catch {
        meta = null;
      }
    }

    await db.insert(auditLogs).values({
      agencyId: entry.agencyId,
      actorId: entry.actorId ?? null,
      actorName: entry.actorName ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      meta,
    });
  } catch {
    // Intentionally swallow — audit logging must never surface to the user.
  }
}
