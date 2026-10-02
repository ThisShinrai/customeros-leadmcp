'use server';

import { z } from 'zod';
import { and, asc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb, type Db } from '@/lib/db';
import { projects, tasks, boardColumns } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { syncTaskColumns, isDoneName } from '@/lib/tasks/sync';

/* ── ownership helpers (tenant isolation) ── */
async function assertProject(db: Db, projectId: string, agencyId: string) {
  const p = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.agencyId, agencyId)) });
  if (!p) throw new Error('NOT_FOUND');
  return p;
}
async function assertColumn(db: Db, columnId: string, agencyId: string) {
  const col = await db.query.boardColumns.findFirst({ where: eq(boardColumns.id, columnId) });
  if (!col) throw new Error('NOT_FOUND');
  await assertProject(db, col.projectId, agencyId);
  return col;
}

const NameSchema = z.string().trim().min(1, 'Name erforderlich').max(40);
const ColorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültige Farbe');

function deriveStatus(col: { isDone: boolean }): 'open' | 'active' | 'done' {
  return col.isDone ? 'done' : 'active';
}
function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/* ── Columns ── */
export async function createColumn(projectId: string, name: string, color: string) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  await assertProject(db, projectId, session.agencyId);
  const safeName = NameSchema.parse(name);
  const safeColor = ColorSchema.parse(color);
  const existing = await db.select({ id: boardColumns.id }).from(boardColumns).where(eq(boardColumns.projectId, projectId));
  // „Fertig"/„Erledigt"/„Done" & Co. zählen automatisch als erledigt —
  // sonst landet eine Aufgabe in „Fertig", bleibt aber im Status „In Arbeit".
  const [col] = await db.insert(boardColumns)
    .values({ projectId, name: safeName, color: safeColor, sortOrder: existing.length, isDone: isDoneName(safeName) })
    .returning();
  revalidatePath(`/app/a/projects/${projectId}`);
  return col;
}

export async function updateColumn(columnId: string, patch: { name?: string; color?: string; isDone?: boolean }) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  const col = await assertColumn(db, columnId, session.agencyId);
  const set: { name?: string; color?: string; isDone?: boolean } = {};
  if (patch.name !== undefined) set.name = NameSchema.parse(patch.name);
  if (patch.color !== undefined) set.color = ColorSchema.parse(patch.color);
  if (patch.isDone !== undefined) set.isDone = !!patch.isDone;
  if (Object.keys(set).length) await db.update(boardColumns).set(set).where(eq(boardColumns.id, columnId));
  // Marking a column done/undone re-syncs its tasks' status (for % + list view)
  // + die globale Aufgaben-Spalte jeder betroffenen Aufgabe.
  if (patch.isDone !== undefined) {
    await db.update(tasks).set({ status: patch.isDone ? 'done' : 'active' }).where(eq(tasks.columnId, columnId));
    const affected = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.columnId, columnId));
    for (const t of affected) {
      await syncTaskColumns(db, { taskId: t.id, agencyId: session.agencyId, projectId: col.projectId, done: !!patch.isDone, skipProject: true });
    }
    revalidatePath('/app/a/dashboard');
    revalidatePath('/app/a/tasks');
  }
  revalidatePath(`/app/a/projects/${col.projectId}`);
  return { ok: true };
}

export async function deleteColumn(columnId: string) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  const col = await assertColumn(db, columnId, session.agencyId);
  const remaining = await db.select().from(boardColumns)
    .where(and(eq(boardColumns.projectId, col.projectId), sql`${boardColumns.id} != ${columnId}`))
    .orderBy(asc(boardColumns.sortOrder));
  const target = remaining[0];
  if (target) {
    await db.update(tasks).set({ columnId: target.id, status: deriveStatus(target) }).where(eq(tasks.columnId, columnId));
  } else {
    await db.update(tasks).set({ columnId: null }).where(eq(tasks.columnId, columnId));
  }
  await db.delete(boardColumns).where(eq(boardColumns.id, columnId));
  revalidatePath(`/app/a/projects/${col.projectId}`);
  return { ok: true };
}

export async function reorderColumns(projectId: string, orderedIds: string[]) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  await assertProject(db, projectId, session.agencyId);
  const cols = await db.select({ id: boardColumns.id }).from(boardColumns).where(eq(boardColumns.projectId, projectId));
  const valid = new Set(cols.map((c) => c.id));
  let i = 0;
  for (const id of orderedIds) {
    if (!valid.has(id)) continue;
    await db.update(boardColumns).set({ sortOrder: i }).where(eq(boardColumns.id, id));
    i++;
  }
  revalidatePath(`/app/a/projects/${projectId}`);
  return { ok: true };
}

/* ── Cards ── */
const CreateBoardTaskSchema = z.object({
  projectId: z.string(),
  columnId: z.string(),
  title: z.string().trim().min(1, 'Titel erforderlich').max(200),
  dueDate: z.string().max(40).optional(),
  assigneeId: z.string().optional(),
});
export async function createBoardTask(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const data = CreateBoardTaskSchema.parse(input);
  const db = await getRequestDb();
  await assertProject(db, data.projectId, session.agencyId);
  const col = await assertColumn(db, data.columnId, session.agencyId);
  if (col.projectId !== data.projectId) throw new Error('NOT_FOUND');
  const count = (await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.columnId, data.columnId))).length;
  const [task] = await db.insert(tasks).values({
    projectId: data.projectId,
    title: data.title,
    columnId: data.columnId,
    status: deriveStatus(col),
    dueDate: parseDate(data.dueDate),
    assigneeId: data.assigneeId || null,
    sortOrder: count,
  }).returning();
  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, data.projectId));
  revalidatePath(`/app/a/projects/${data.projectId}`);
  revalidatePath('/app/a/dashboard');
  return {
    id: task.id, title: task.title, status: task.status, columnId: task.columnId,
    dueDate: task.dueDate ? new Date(task.dueDate).getTime() : null, assigneeId: task.assigneeId,
  };
}

/**
 * Persist a drag-drop: move a task into `toColumnId` and re-number that column
 * to match the client's `orderedIds`. Status is derived from the target column.
 */
export async function moveTask(taskId: string, toColumnId: string, orderedIds: string[]) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) throw new Error('NOT_FOUND');
  await assertProject(db, task.projectId, session.agencyId);
  const col = await assertColumn(db, toColumnId, session.agencyId);
  if (col.projectId !== task.projectId) throw new Error('NOT_FOUND');

  await db.update(tasks).set({ columnId: toColumnId, status: deriveStatus(col) }).where(eq(tasks.id, taskId));
  await syncTaskColumns(db, { taskId, agencyId: session.agencyId, projectId: task.projectId, done: deriveStatus(col) === 'done', skipProject: true });
  let i = 0;
  for (const id of orderedIds) {
    await db.update(tasks).set({ sortOrder: i }).where(and(eq(tasks.id, id), eq(tasks.projectId, task.projectId)));
    i++;
  }
  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, task.projectId));
  revalidatePath(`/app/a/projects/${task.projectId}`);
  revalidatePath('/app/a/dashboard');
  revalidatePath('/app/a/tasks');
  return { ok: true };
}
