'use server';

import { z } from 'zod';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb, type Db } from '@/lib/db';
import {
  projects, tasks, boardColumns, chatChannels, chatParticipants, messages,
  projectClients, projectMembers, files, folders, whiteboards, projectResources,
  timeEntries, recurringInvoices, appointments, proposals, invoices,
} from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { deleteObject } from '@/lib/storage/r2';

async function assertProject(db: Db, projectId: string, agencyId: string) {
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.agencyId, agencyId)) });
  if (!project) throw new Error('NOT_FOUND');
  return project;
}

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const CreateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name erforderlich').max(120),
  description: z.string().trim().max(2000).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  status: z.enum(['open', 'active', 'feedback', 'done']).optional(),
  clientIds: z.array(z.string()).optional(),
  memberIds: z.array(z.string()).optional(),
});

export async function createProject(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:create');
  const data = CreateProjectSchema.parse(input);
  const db = await getRequestDb();

  const [project] = await db.insert(projects).values({
    agencyId: session.agencyId,
    name: data.name,
    description: data.description || null,
    status: data.status ?? 'open',
    startDate: parseDate(data.startDate),
    endDate: parseDate(data.endDate),
  }).returning();

  // Auto-create the project chat channel.
  const [channel] = await db.insert(chatChannels).values({
    projectId: project.id,
    name: project.name,
    type: 'project',
  }).returning();

  // Participants: creator + assigned members + assigned clients.
  const participantRows: { channelId: string; participantId: string; participantType: 'agency_user' | 'client_user' }[] = [
    { channelId: channel.id, participantId: session.user.id, participantType: 'agency_user' },
  ];
  for (const mid of data.memberIds ?? []) {
    await db.insert(projectMembers).values({ projectId: project.id, userId: mid });
    if (mid !== session.user.id) participantRows.push({ channelId: channel.id, participantId: mid, participantType: 'agency_user' });
  }
  for (const cid of data.clientIds ?? []) {
    await db.insert(projectClients).values({ projectId: project.id, clientId: cid });
    participantRows.push({ channelId: channel.id, participantId: cid, participantType: 'client_user' });
  }
  await db.insert(chatParticipants).values(participantRows);

  revalidatePath('/app/a/projects');
  revalidatePath('/app/a/dashboard');
  return { id: project.id };
}

const UpdateProjectSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  startDate: z.string().max(40).nullable().optional(),
  endDate: z.string().max(40).nullable().optional(),
});

export async function updateProject(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const data = UpdateProjectSchema.parse(input);
  const db = await getRequestDb();
  await assertProject(db, data.id, session.agencyId);

  await db.update(projects).set({
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.startDate !== undefined ? { startDate: parseDate(data.startDate) } : {}),
    ...(data.endDate !== undefined ? { endDate: parseDate(data.endDate) } : {}),
    updatedAt: new Date(),
  }).where(eq(projects.id, data.id));

  revalidatePath('/app/a/projects');
  revalidatePath(`/app/a/projects/${data.id}`);
  return { ok: true };
}

export async function setProjectStatus(id: string, status: 'open' | 'active' | 'feedback' | 'done' | 'archived') {
  const session = await requireAgencySession();
  assertCan(session, status === 'archived' ? 'projects:archive' : 'projects:edit');
  const db = await getRequestDb();
  await assertProject(db, id, session.agencyId);
  await db.update(projects).set({ status, updatedAt: new Date() }).where(eq(projects.id, id));
  revalidatePath('/app/a/projects');
  revalidatePath(`/app/a/projects/${id}`);
  revalidatePath('/app/a/dashboard');
  return { ok: true };
}

export async function deleteProject(id: string) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:delete');
  const db = await getRequestDb();
  await assertProject(db, id, session.agencyId);

  // Rechnungen sind Finanzbelege — ein Projekt mit Rechnungen wird nicht gelöscht.
  const hasInvoice = await db.query.invoices.findFirst({ where: eq(invoices.projectId, id) });
  if (hasInvoice) throw new Error('HAS_INVOICES');

  // Cascade über ALLE referenzierenden Tabellen (Kinder vor Eltern):
  // files (+R2) → folders, chat, time_entries → tasks → board_columns,
  // whiteboards, resources, recurring, Termine/Angebote entkoppeln.
  const projectFiles = await db.select().from(files).where(eq(files.projectId, id));
  for (const f of projectFiles) { try { await deleteObject(f.r2Key); } catch { /* ignore */ } }
  await db.delete(files).where(eq(files.projectId, id));
  await db.delete(folders).where(eq(folders.projectId, id));

  const channels = await db.select({ id: chatChannels.id }).from(chatChannels).where(eq(chatChannels.projectId, id));
  for (const c of channels) {
    await db.delete(messages).where(eq(messages.channelId, c.id));
    await db.delete(chatParticipants).where(eq(chatParticipants.channelId, c.id));
  }
  await db.delete(chatChannels).where(eq(chatChannels.projectId, id));

  await db.delete(timeEntries).where(eq(timeEntries.projectId, id));
  // Subtasks zuerst (tasks.parent_id referenziert tasks.id).
  await db.delete(tasks).where(and(eq(tasks.projectId, id), isNotNull(tasks.parentId)));
  await db.delete(tasks).where(eq(tasks.projectId, id));
  await db.delete(boardColumns).where(eq(boardColumns.projectId, id));
  await db.delete(whiteboards).where(eq(whiteboards.projectId, id));
  await db.delete(projectResources).where(eq(projectResources.projectId, id));
  await db.delete(recurringInvoices).where(eq(recurringInvoices.projectId, id));
  // Termine und Angebote bleiben bestehen — nur die Projekt-Verknüpfung lösen.
  await db.update(appointments).set({ projectId: null }).where(eq(appointments.projectId, id));
  await db.update(proposals).set({ projectId: null }).where(eq(proposals.projectId, id));

  await db.delete(projectClients).where(eq(projectClients.projectId, id));
  await db.delete(projectMembers).where(eq(projectMembers.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));

  revalidatePath('/app/a/projects');
  revalidatePath('/app/a/dashboard');
  return { ok: true };
}

export async function setProjectClients(projectId: string, clientIds: string[]) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  await assertProject(db, projectId, session.agencyId);

  const existing = await db.select().from(projectClients).where(eq(projectClients.projectId, projectId));
  const existingIds = new Set(existing.map((e) => e.clientId));
  const nextIds = new Set(clientIds);

  const channel = await db.query.chatChannels.findFirst({ where: and(eq(chatChannels.projectId, projectId), eq(chatChannels.type, 'project')) });

  for (const cid of clientIds) {
    if (!existingIds.has(cid)) {
      await db.insert(projectClients).values({ projectId, clientId: cid });
      if (channel) await db.insert(chatParticipants).values({ channelId: channel.id, participantId: cid, participantType: 'client_user' });
    }
  }
  for (const e of existing) {
    if (!nextIds.has(e.clientId)) {
      await db.delete(projectClients).where(and(eq(projectClients.projectId, projectId), eq(projectClients.clientId, e.clientId)));
      if (channel) await db.delete(chatParticipants).where(and(eq(chatParticipants.channelId, channel.id), eq(chatParticipants.participantId, e.clientId)));
    }
  }
  revalidatePath(`/app/a/projects/${projectId}`);
  return { ok: true };
}

/* ─────────────────── Members & chat access ─────────────────── */

/** Assign agency members to a project — they become the released chat contacts
 *  for the project's client(s). Syncs the project channel participants too. */
export async function setProjectMembers(projectId: string, memberIds: string[]) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  await assertProject(db, projectId, session.agencyId);

  const existing = await db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));
  const existingIds = new Set(existing.map((e) => e.userId));
  const nextIds = new Set(memberIds);
  const channel = await db.query.chatChannels.findFirst({ where: and(eq(chatChannels.projectId, projectId), eq(chatChannels.type, 'project')) });

  for (const uid of memberIds) {
    if (!existingIds.has(uid)) {
      await db.insert(projectMembers).values({ projectId, userId: uid });
      if (channel) {
        const has = await db.query.chatParticipants.findFirst({ where: and(eq(chatParticipants.channelId, channel.id), eq(chatParticipants.participantId, uid)) });
        if (!has) await db.insert(chatParticipants).values({ channelId: channel.id, participantId: uid, participantType: 'agency_user' });
      }
    }
  }
  for (const e of existing) {
    if (!nextIds.has(e.userId)) {
      await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, e.userId)));
      if (channel) await db.delete(chatParticipants).where(and(eq(chatParticipants.channelId, channel.id), eq(chatParticipants.participantId, e.userId)));
    }
  }
  revalidatePath(`/app/a/projects/${projectId}`);
  return { ok: true };
}

/** Toggle whether the project's client may chat with ALL agency users. */
export async function setChatBypass(projectId: string, bypass: boolean) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  await assertProject(db, projectId, session.agencyId);
  await db.update(projects).set({ chatBypass: bypass, updatedAt: new Date() }).where(eq(projects.id, projectId));
  revalidatePath(`/app/a/projects/${projectId}`);
  return { ok: true };
}

/* ─────────────────────────── Tasks ─────────────────────────── */

const CreateTaskSchema = z.object({
  projectId: z.string(),
  title: z.string().trim().min(1, 'Titel erforderlich').max(200),
  dueDate: z.string().max(40).optional(),
  assigneeId: z.string().optional(),
});

export async function createTask(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const data = CreateTaskSchema.parse(input);
  const db = await getRequestDb();
  await assertProject(db, data.projectId, session.agencyId);

  const count = (await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, data.projectId))).length;
  // Land new tasks in the first Kanban column so they show up on the board.
  const firstCol = (await db.select({ id: boardColumns.id }).from(boardColumns).where(eq(boardColumns.projectId, data.projectId)).orderBy(asc(boardColumns.sortOrder)).limit(1))[0];
  const [task] = await db.insert(tasks).values({
    projectId: data.projectId,
    title: data.title,
    dueDate: parseDate(data.dueDate),
    assigneeId: data.assigneeId || null,
    columnId: firstCol?.id ?? null,
    sortOrder: count,
  }).returning();
  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, data.projectId));
  revalidatePath(`/app/a/projects/${data.projectId}`);
  return { id: task.id, title: task.title, status: task.status, dueDate: task.dueDate ? new Date(task.dueDate).getTime() : null };
}

async function assertTask(db: Db, taskId: string, agencyId: string) {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) throw new Error('NOT_FOUND');
  await assertProject(db, task.projectId, agencyId);
  return task;
}

export async function setTaskStatus(taskId: string, status: 'open' | 'active' | 'done') {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  const task = await assertTask(db, taskId, session.agencyId);
  // Keep the Kanban column in sync with the list-view status toggle.
  const cols = await db.select().from(boardColumns).where(eq(boardColumns.projectId, task.projectId)).orderBy(asc(boardColumns.sortOrder));
  const targetCol = status === 'done'
    ? (cols.find((c) => c.isDone) ?? cols[cols.length - 1])
    : (cols.find((c) => !c.isDone) ?? cols[0]);
  await db.update(tasks).set({ status, ...(targetCol ? { columnId: targetCol.id } : {}) }).where(eq(tasks.id, taskId));
  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, task.projectId));
  revalidatePath(`/app/a/projects/${task.projectId}`);
  revalidatePath('/app/a/dashboard');
  return { ok: true };
}

export async function deleteTask(taskId: string) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  const task = await assertTask(db, taskId, session.agencyId);
  await db.delete(tasks).where(eq(tasks.parentId, taskId)); // cascade subtasks
  await db.delete(tasks).where(eq(tasks.id, taskId));
  revalidatePath(`/app/a/projects/${task.projectId}`);
  revalidatePath('/app/a/tasks');
  revalidatePath('/app/a/dashboard');
  return { ok: true };
}

const UpdateTaskSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().max(40).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

export async function updateTask(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const data = UpdateTaskSchema.parse(input);
  const db = await getRequestDb();
  const task = await assertTask(db, data.id, session.agencyId);
  await db.update(tasks).set({
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { description: data.description || null } : {}),
    ...(data.priority !== undefined ? { priority: data.priority } : {}),
    ...(data.dueDate !== undefined ? { dueDate: parseDate(data.dueDate) } : {}),
    ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
  }).where(eq(tasks.id, data.id));
  revalidatePath(`/app/a/projects/${task.projectId}`);
  revalidatePath('/app/a/tasks');
  return { ok: true };
}
