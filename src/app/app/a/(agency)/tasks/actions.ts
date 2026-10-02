'use server';

import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb, type Db } from '@/lib/db';
import { tasks, projects, boardColumns, agencyUsers } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { syncTaskColumns } from '@/lib/tasks/sync';

async function assertProject(db: Db, projectId: string, agencyId: string) {
  const p = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.agencyId, agencyId)) });
  if (!p) throw new Error('NOT_FOUND');
  return p;
}
async function assertTaskOwned(db: Db, taskId: string, agencyId: string) {
  const t = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!t) throw new Error('NOT_FOUND');
  await assertProject(db, t.projectId, agencyId);
  return t;
}
function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export interface TaskDetailData {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'active' | 'done';
  columnId: string | null;
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  dueDate: number | null;
  assigneeId: string | null;
  projectId: string;
  projectName: string;
  subtasks: { id: string; title: string; done: boolean }[];
  columns: { id: string; name: string; color: string; isDone: boolean }[];
  members: { id: string; name: string }[];
}

/** Full task detail for the Asana-style drawer (subtasks, project columns, members). */
export async function getTaskDetail(taskId: string): Promise<TaskDetailData | null> {
  const session = await requireAgencySession();
  const db = await getRequestDb();
  const t = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!t) return null;
  const proj = await db.query.projects.findFirst({ where: and(eq(projects.id, t.projectId), eq(projects.agencyId, session.agencyId)) });
  if (!proj) return null; // tenant isolation

  const [subs, cols, members] = await Promise.all([
    db.select({ id: tasks.id, title: tasks.title, status: tasks.status }).from(tasks).where(eq(tasks.parentId, taskId)).orderBy(asc(tasks.sortOrder), asc(tasks.createdAt)),
    db.select({ id: boardColumns.id, name: boardColumns.name, color: boardColumns.color, isDone: boardColumns.isDone }).from(boardColumns).where(eq(boardColumns.projectId, t.projectId)).orderBy(asc(boardColumns.sortOrder)),
    db.select({ id: agencyUsers.id, name: agencyUsers.name }).from(agencyUsers).where(and(eq(agencyUsers.agencyId, session.agencyId), eq(agencyUsers.status, 'active'))),
  ]);

  return {
    id: t.id, title: t.title, description: t.description, status: t.status, columnId: t.columnId,
    priority: t.priority, dueDate: t.dueDate ? t.dueDate.getTime() : null, assigneeId: t.assigneeId,
    projectId: t.projectId, projectName: proj.name,
    subtasks: subs.map((s) => ({ id: s.id, title: s.title, done: s.status === 'done' })),
    columns: cols,
    members,
  };
}

const CreateGlobalTaskSchema = z.object({
  projectId: z.string(),
  title: z.string().trim().min(1, 'Titel erforderlich').max(200),
  columnId: z.string().optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().max(40).optional(),
  assigneeId: z.string().optional(),
  description: z.string().trim().max(5000).optional(),
});

/** Create a top-level task in any project (used by the global tasks page). */
export async function createGlobalTask(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const data = CreateGlobalTaskSchema.parse(input);
  const db = await getRequestDb();
  await assertProject(db, data.projectId, session.agencyId);

  let columnId: string | null = null;
  let columnDone = false;
  if (data.columnId) {
    const col = await db.query.boardColumns.findFirst({ where: eq(boardColumns.id, data.columnId) });
    if (col && col.projectId === data.projectId) { columnId = col.id; columnDone = col.isDone; }
  }
  if (!columnId) {
    const first = (await db.select({ id: boardColumns.id, isDone: boardColumns.isDone }).from(boardColumns).where(eq(boardColumns.projectId, data.projectId)).orderBy(asc(boardColumns.sortOrder)).limit(1))[0];
    columnId = first?.id ?? null;
    columnDone = first?.isDone ?? false;
  }
  const count = (await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, data.projectId))).length;
  const [task] = await db.insert(tasks).values({
    projectId: data.projectId,
    title: data.title,
    columnId,
    status: columnDone ? 'done' : 'open',
    priority: data.priority ?? 'none',
    dueDate: parseDate(data.dueDate),
    assigneeId: data.assigneeId || null,
    description: data.description || null,
    sortOrder: count,
  }).returning();
  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, data.projectId));
  revalidatePath('/app/a/tasks');
  revalidatePath(`/app/a/projects/${data.projectId}`);
  revalidatePath('/app/a/dashboard');
  return { id: task.id };
}

/** Add a subtask (child) to a parent task — same project, no board column. */
export async function createSubtask(parentId: string, title: string) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  const parent = await assertTaskOwned(db, parentId, session.agencyId);
  const safe = z.string().trim().min(1).max(200).parse(title);
  const count = (await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.parentId, parentId))).length;
  const [sub] = await db.insert(tasks).values({
    projectId: parent.projectId, title: safe, parentId, status: 'open', sortOrder: count,
  }).returning();
  revalidatePath(`/app/a/projects/${parent.projectId}`);
  revalidatePath('/app/a/tasks');
  return { id: sub.id, title: sub.title, done: false };
}

/** Move a task to another column of its project (drawer column selector). */
export async function setTaskColumn(taskId: string, columnId: string) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  const task = await assertTaskOwned(db, taskId, session.agencyId);
  const col = await db.query.boardColumns.findFirst({ where: eq(boardColumns.id, columnId) });
  if (!col || col.projectId !== task.projectId) throw new Error('NOT_FOUND');
  await db.update(tasks).set({ columnId, status: col.isDone ? 'done' : 'active' }).where(eq(tasks.id, taskId));
  // Globale Aufgaben-Spalte nachziehen (Fertig ↔ nicht fertig gilt überall).
  await syncTaskColumns(db, { taskId, agencyId: session.agencyId, projectId: task.projectId, done: col.isDone, skipProject: true });
  revalidatePath(`/app/a/projects/${task.projectId}`);
  revalidatePath('/app/a/tasks');
  revalidatePath('/app/a/dashboard');
  return { ok: true };
}

/** Toggle a subtask done/open (plain status flip — no board column logic). */
export async function toggleSubtask(id: string, done: boolean) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  const sub = await assertTaskOwned(db, id, session.agencyId);
  await db.update(tasks).set({ status: done ? 'done' : 'open' }).where(eq(tasks.id, id));
  revalidatePath(`/app/a/projects/${sub.projectId}`);
  revalidatePath('/app/a/tasks');
  revalidatePath('/app/a/dashboard');
  return { ok: true };
}
