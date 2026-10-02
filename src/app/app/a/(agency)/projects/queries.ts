import { and, asc, eq, desc, inArray } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import {
  projects, tasks, boardColumns, files, chatChannels, messages, projectClients, projectMembers,
  clientUsers, agencyUsers, type Project, type Task, type BoardColumn,
} from '@/lib/db';

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  status: Project['status'];
  percent: number;
  taskTotal: number;
  taskDone: number;
  fileCount: number;
  messageCount: number;
  clientNames: string[];
  clientIds: string[];
  startDate: Date | null;
  endDate: Date | null;
  updatedAt: Date | null;
}

export function computePercent(status: Project['status'], done: number, total: number): number {
  if (status === 'done') return 100;
  if (total === 0) return status === 'active' || status === 'feedback' ? 5 : 0;
  return Math.round((done / total) * 100);
}

export async function listProjects(agencyId: string, includeArchived = false): Promise<ProjectListItem[]> {
  const db = await getRequestDb();
  const rows = await db.select().from(projects).where(eq(projects.agencyId, agencyId)).orderBy(desc(projects.updatedAt));
  const filtered = includeArchived ? rows : rows.filter((r) => r.status !== 'archived');
  const ids = filtered.map((r) => r.id);
  if (ids.length === 0) return [];

  const [allTasks, allFiles, channels, pcs] = await Promise.all([
    db.select({ id: tasks.id, projectId: tasks.projectId, status: tasks.status }).from(tasks).where(inArray(tasks.projectId, ids)),
    db.select({ projectId: files.projectId }).from(files).where(inArray(files.projectId, ids)),
    db.select({ id: chatChannels.id, projectId: chatChannels.projectId }).from(chatChannels).where(inArray(chatChannels.projectId, ids)),
    db.select({ projectId: projectClients.projectId, clientId: projectClients.clientId, name: clientUsers.name }).from(projectClients)
      .innerJoin(clientUsers, eq(projectClients.clientId, clientUsers.id))
      .where(inArray(projectClients.projectId, ids)),
  ]);

  const channelIds = channels.map((c) => c.id);
  const msgs = channelIds.length
    ? await db.select({ channelId: messages.channelId }).from(messages).where(inArray(messages.channelId, channelIds))
    : [];
  const channelToProject = new Map(channels.map((c) => [c.id, c.projectId]));

  const taskTotal = new Map<string, number>();
  const taskDone = new Map<string, number>();
  for (const t of allTasks) {
    taskTotal.set(t.projectId, (taskTotal.get(t.projectId) ?? 0) + 1);
    if (t.status === 'done') taskDone.set(t.projectId, (taskDone.get(t.projectId) ?? 0) + 1);
  }
  const fileCount = new Map<string, number>();
  for (const f of allFiles) fileCount.set(f.projectId, (fileCount.get(f.projectId) ?? 0) + 1);
  const msgCount = new Map<string, number>();
  for (const m of msgs) {
    const pid = channelToProject.get(m.channelId);
    if (pid) msgCount.set(pid, (msgCount.get(pid) ?? 0) + 1);
  }
  const clientNames = new Map<string, string[]>();
  const clientIds = new Map<string, string[]>();
  for (const pc of pcs) {
    const arr = clientNames.get(pc.projectId) ?? [];
    arr.push(pc.name);
    clientNames.set(pc.projectId, arr);
    const idArr = clientIds.get(pc.projectId) ?? [];
    idArr.push(pc.clientId);
    clientIds.set(pc.projectId, idArr);
  }

  return filtered.map((p) => {
    const total = taskTotal.get(p.id) ?? 0;
    const done = taskDone.get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      percent: computePercent(p.status, done, total),
      taskTotal: total,
      taskDone: done,
      fileCount: fileCount.get(p.id) ?? 0,
      messageCount: msgCount.get(p.id) ?? 0,
      clientNames: clientNames.get(p.id) ?? [],
      clientIds: clientIds.get(p.id) ?? [],
      startDate: p.startDate,
      endDate: p.endDate,
      updatedAt: p.updatedAt,
    };
  });
}

export async function listAssignable(agencyId: string): Promise<{
  clients: { id: string; name: string; company: string | null }[];
  members: { id: string; name: string; role: string }[];
}> {
  const db = await getRequestDb();
  const [clients, members] = await Promise.all([
    db.select({ id: clientUsers.id, name: clientUsers.name, company: clientUsers.company }).from(clientUsers).where(eq(clientUsers.agencyId, agencyId)),
    db.select({ id: agencyUsers.id, name: agencyUsers.name, role: agencyUsers.role }).from(agencyUsers).where(and(eq(agencyUsers.agencyId, agencyId), eq(agencyUsers.status, 'active'))),
  ]);
  return { clients, members };
}

export interface ProjectFileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploaderType: 'agency_user' | 'client_user';
  uploaderName: string;
  visibleToClient: boolean;
  folderId: string | null;
  createdAt: Date | null;
}

export interface ProjectDetail {
  project: Project;
  tasks: Task[];
  columns: BoardColumn[];
  subtaskCounts: Record<string, { total: number; done: number }>;
  percent: number;
  clients: { id: string; name: string; company: string | null }[];
  members: { id: string; name: string; role: string }[];
  files: ProjectFileItem[];
  channelId: string | null;
}

export async function getProjectDetail(agencyId: string, projectId: string): Promise<ProjectDetail | null> {
  const db = await getRequestDb();
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.agencyId, agencyId)) });
  if (!project) return null;

  const [taskRows, clientRows, memberRows, fileRows, channel, columnRows] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(tasks.sortOrder, tasks.createdAt),
    db.select({ id: clientUsers.id, name: clientUsers.name, company: clientUsers.company }).from(projectClients)
      .innerJoin(clientUsers, eq(projectClients.clientId, clientUsers.id)).where(eq(projectClients.projectId, projectId)),
    db.select({ id: agencyUsers.id, name: agencyUsers.name, role: agencyUsers.role }).from(projectMembers)
      .innerJoin(agencyUsers, eq(projectMembers.userId, agencyUsers.id)).where(eq(projectMembers.projectId, projectId)),
    db.select().from(files).where(eq(files.projectId, projectId)).orderBy(desc(files.createdAt)),
    db.query.chatChannels.findFirst({ where: and(eq(chatChannels.projectId, projectId), eq(chatChannels.type, 'project')) }),
    db.select().from(boardColumns).where(eq(boardColumns.projectId, projectId)).orderBy(asc(boardColumns.sortOrder)),
  ]);

  // Resolve uploader names.
  const [allAgencyUsers, allClients] = await Promise.all([
    db.select({ id: agencyUsers.id, name: agencyUsers.name }).from(agencyUsers).where(eq(agencyUsers.agencyId, agencyId)),
    db.select({ id: clientUsers.id, name: clientUsers.name }).from(clientUsers).where(eq(clientUsers.agencyId, agencyId)),
  ]);
  const nameById = new Map<string, string>();
  for (const u of allAgencyUsers) nameById.set(u.id, u.name);
  for (const c of allClients) nameById.set(c.id, c.name);

  const fileItems: ProjectFileItem[] = fileRows.map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    mimeType: f.mimeType,
    uploaderType: f.uploaderType,
    uploaderName: nameById.get(f.uploadedBy) ?? (f.uploaderType === 'client_user' ? 'Kunde' : 'Team'),
    visibleToClient: f.visibleToClient,
    folderId: f.folderId,
    createdAt: f.createdAt,
  }));

  // Split top-level tasks (board cards) from subtasks; aggregate subtask progress.
  const topLevel = taskRows.filter((t) => !t.parentId);
  const subtaskCounts: Record<string, { total: number; done: number }> = {};
  for (const t of taskRows) {
    if (!t.parentId) continue;
    const c = (subtaskCounts[t.parentId] ??= { total: 0, done: 0 });
    c.total++;
    if (t.status === 'done') c.done++;
  }

  const done = topLevel.filter((t) => t.status === 'done').length;
  return {
    project,
    tasks: topLevel,
    columns: columnRows,
    subtaskCounts,
    percent: computePercent(project.status, done, topLevel.length),
    clients: clientRows,
    members: memberRows,
    files: fileItems,
    channelId: channel?.id ?? null,
  };
}
