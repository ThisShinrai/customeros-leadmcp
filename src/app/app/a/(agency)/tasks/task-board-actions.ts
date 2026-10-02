'use server';

import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb, type Db } from '@/lib/db';
import { taskColumns, tasks, projects, type TaskColumn } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { syncTaskColumns, isDoneName } from '@/lib/tasks/sync';

const Name = z.string().trim().min(1).max(60);
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

async function ownedColumn(db: Db, id: string, agencyId: string): Promise<TaskColumn> {
  const c = await db.query.taskColumns.findFirst({ where: and(eq(taskColumns.id, id), eq(taskColumns.agencyId, agencyId)) });
  if (!c) throw new Error('FORBIDDEN');
  return c;
}
async function assertTaskInAgency(db: Db, taskId: string, agencyId: string) {
  const t = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!t) throw new Error('NOT_FOUND');
  const p = await db.query.projects.findFirst({ where: and(eq(projects.id, t.projectId), eq(projects.agencyId, agencyId)) });
  if (!p) throw new Error('FORBIDDEN');
  return t;
}

export async function createTaskColumn(name: string): Promise<TaskColumn> {
  const s = await requireAgencySession();
  assertCan(s, 'projects:edit');
  const db = await getRequestDb();
  const safe = Name.parse(name);
  const count = (await db.select({ id: taskColumns.id }).from(taskColumns).where(eq(taskColumns.agencyId, s.agencyId))).length;
  const [col] = await db.insert(taskColumns).values({ agencyId: s.agencyId, name: safe, sortOrder: count, isDone: isDoneName(safe) }).returning();
  revalidatePath('/app/a/tasks');
  return col;
}

export async function updateTaskColumn(id: string, patch: { name?: string; color?: string; isDone?: boolean }): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'projects:edit');
  const db = await getRequestDb();
  await ownedColumn(db, id, s.agencyId);
  await db.update(taskColumns).set({
    ...(patch.name !== undefined ? { name: Name.parse(patch.name) } : {}),
    ...(patch.color !== undefined ? { color: Color.parse(patch.color) } : {}),
    ...(patch.isDone !== undefined ? { isDone: patch.isDone } : {}),
  }).where(eq(taskColumns.id, id));
  revalidatePath('/app/a/tasks');
  return { ok: true };
}

/** Delete a column; its tasks fall back to the first remaining column. Never deletes the last column. */
export async function deleteTaskColumn(id: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'projects:edit');
  const db = await getRequestDb();
  await ownedColumn(db, id, s.agencyId);
  const cols = await db.select().from(taskColumns).where(eq(taskColumns.agencyId, s.agencyId)).orderBy(asc(taskColumns.sortOrder));
  if (cols.length <= 1) throw new Error('LAST_COLUMN');
  const fallback = cols.find((c) => c.id !== id)!;
  await db.update(tasks).set({ taskColumnId: fallback.id }).where(eq(tasks.taskColumnId, id));
  await db.delete(taskColumns).where(eq(taskColumns.id, id));
  revalidatePath('/app/a/tasks');
  return { ok: true };
}

export async function reorderTaskColumns(orderedIds: string[]): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'projects:edit');
  const db = await getRequestDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(taskColumns).set({ sortOrder: i }).where(and(eq(taskColumns.id, orderedIds[i]), eq(taskColumns.agencyId, s.agencyId)));
  }
  revalidatePath('/app/a/tasks');
  return { ok: true };
}

/** Move a task to a column + persist the new ordering. Keeps the legacy status enum in sync via the column's isDone flag. */
export async function moveTaskToColumn(taskId: string, toColumnId: string, orderedIds: string[]): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'projects:edit');
  const db = await getRequestDb();
  const t = await assertTaskInAgency(db, taskId, s.agencyId);
  const col = await ownedColumn(db, toColumnId, s.agencyId);
  let status: 'open' | 'active' | 'done' = t.status;
  if (col.isDone) status = 'done';
  else if (t.status === 'done') status = 'active';
  await db.update(tasks).set({ taskColumnId: toColumnId, status }).where(eq(tasks.id, taskId));
  // Projekt-Board-Spalte nachziehen, damit die Aufgabe überall als (nicht) fertig gilt.
  await syncTaskColumns(db, { taskId, agencyId: s.agencyId, projectId: t.projectId, done: status === 'done', skipGlobal: true });
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(tasks).set({ boardSort: i }).where(eq(tasks.id, orderedIds[i]));
  }
  revalidatePath('/app/a/tasks');
  revalidatePath(`/app/a/projects/${t.projectId}`);
  revalidatePath('/app/a/dashboard');
  return { ok: true };
}
