import { asc, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { boardColumns, taskColumns, tasks } from '@/lib/db';

/**
 * Eine Aufgabe hat drei Status-Dimensionen: den Legacy-Status (open/active/done),
 * die Projekt-Board-Spalte (column_id) und die globale Aufgaben-Spalte
 * (task_column_id). Dieses Modul hält sie zusammen, damit „auf Fertig setzen"
 * überall als fertig erscheint — egal wo man es tut.
 */

/** Spaltennamen, die beim Anlegen automatisch als „erledigt" gelten. */
export const DONE_COLUMN_NAMES = /^(fertig|erledigt|done|abgeschlossen|completed|geschafft)$/i;

export function isDoneName(name: string): boolean {
  return DONE_COLUMN_NAMES.test(name.trim());
}

/**
 * Zieht nach einem Statuswechsel die jeweils andere Board-Dimension nach:
 * done → in die erste „erledigt"-Spalte; nicht mehr done → aus einer
 * „erledigt"-Spalte in die erste normale Spalte. Fehlt eine passende Spalte,
 * bleibt die Zuordnung unangetastet.
 */
export async function syncTaskColumns(db: Db, opts: {
  taskId: string;
  agencyId: string;
  projectId: string;
  done: boolean;
  /** Projekt-Spalte nicht anfassen (weil sie gerade selbst gesetzt wurde). */
  skipProject?: boolean;
  /** Globale Spalte nicht anfassen (weil sie gerade selbst gesetzt wurde). */
  skipGlobal?: boolean;
}): Promise<void> {
  const t = await db.query.tasks.findFirst({ where: eq(tasks.id, opts.taskId) });
  if (!t) return;

  if (!opts.skipGlobal) {
    const cols = await db.select().from(taskColumns).where(eq(taskColumns.agencyId, opts.agencyId)).orderBy(asc(taskColumns.sortOrder));
    const cur = cols.find((c) => c.id === t.taskColumnId);
    const target = opts.done
      ? cols.find((c) => c.isDone)
      : (cur?.isDone ? cols.find((c) => !c.isDone) : undefined);
    if (target && target.id !== t.taskColumnId) {
      await db.update(tasks).set({ taskColumnId: target.id }).where(eq(tasks.id, opts.taskId));
    }
  }

  if (!opts.skipProject) {
    const cols = await db.select().from(boardColumns).where(eq(boardColumns.projectId, opts.projectId)).orderBy(asc(boardColumns.sortOrder));
    const cur = cols.find((c) => c.id === t.columnId);
    const target = opts.done
      ? cols.find((c) => c.isDone)
      : (cur?.isDone ? cols.find((c) => !c.isDone) : undefined);
    if (target && target.id !== t.columnId) {
      await db.update(tasks).set({ columnId: target.id }).where(eq(tasks.id, opts.taskId));
    }
  }
}
