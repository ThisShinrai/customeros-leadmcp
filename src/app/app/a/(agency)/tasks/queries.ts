import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { tasks, projects, boardColumns, agencyUsers, taskColumns, type TaskColumn } from '@/lib/db';

export type { TaskColumn };

export interface ProjectOption {
  id: string;
  name: string;
  columns: { id: string; name: string; color: string; isDone: boolean }[];
}

export interface GlobalTask {
  id: string;
  title: string;
  hasDescription: boolean;
  projectId: string;
  projectName: string;
  status: 'open' | 'active' | 'done';
  columnId: string | null;
  columnName: string | null;
  columnColor: string | null;
  taskColumnId: string | null;
  boardSort: number;
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  dueDate: number | null;
  assigneeId: string | null;
  assigneeName: string | null;
  subtaskTotal: number;
  subtaskDone: number;
  createdAt: number | null;
}

export interface AllTasksData {
  tasks: GlobalTask[];
  projects: ProjectOption[];
  members: { id: string; name: string }[];
}

/** Every top-level task across the agency's projects, enriched for the global board. */
export async function getAllTasks(agencyId: string): Promise<AllTasksData> {
  const db = await getRequestDb();

  const rows = await db
    .select({
      id: tasks.id, title: tasks.title, description: tasks.description, status: tasks.status,
      columnId: tasks.columnId, taskColumnId: tasks.taskColumnId, boardSort: tasks.boardSort, priority: tasks.priority, dueDate: tasks.dueDate,
      assigneeId: tasks.assigneeId, createdAt: tasks.createdAt, parentId: tasks.parentId,
      projectId: projects.id, projectName: projects.name, projectStatus: projects.status,
      columnName: boardColumns.name, columnColor: boardColumns.color,
      assigneeName: agencyUsers.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(boardColumns, eq(tasks.columnId, boardColumns.id))
    .leftJoin(agencyUsers, eq(tasks.assigneeId, agencyUsers.id))
    .where(eq(projects.agencyId, agencyId));

  const counts: Record<string, { total: number; done: number }> = {};
  for (const r of rows) {
    if (!r.parentId) continue;
    const c = (counts[r.parentId] ??= { total: 0, done: 0 });
    c.total++;
    if (r.status === 'done') c.done++;
  }

  const tasksOut: GlobalTask[] = rows
    .filter((r) => !r.parentId && r.projectStatus !== 'archived')
    .map((r) => ({
      id: r.id,
      title: r.title,
      hasDescription: !!(r.description && r.description.trim()),
      projectId: r.projectId,
      projectName: r.projectName,
      status: r.status,
      columnId: r.columnId,
      columnName: r.columnName,
      columnColor: r.columnColor,
      taskColumnId: r.taskColumnId,
      boardSort: r.boardSort,
      priority: r.priority,
      dueDate: r.dueDate ? r.dueDate.getTime() : null,
      assigneeId: r.assigneeId,
      assigneeName: r.assigneeName,
      subtaskTotal: counts[r.id]?.total ?? 0,
      subtaskDone: counts[r.id]?.done ?? 0,
      createdAt: r.createdAt ? r.createdAt.getTime() : null,
    }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const projectRows = await db
    .select({ id: projects.id, name: projects.name, status: projects.status })
    .from(projects)
    .where(eq(projects.agencyId, agencyId));
  const activeProjects = projectRows.filter((p) => p.status !== 'archived');

  const colRows = activeProjects.length
    ? await db.select({ id: boardColumns.id, projectId: boardColumns.projectId, name: boardColumns.name, color: boardColumns.color, isDone: boardColumns.isDone })
        .from(boardColumns)
        .where(inArray(boardColumns.projectId, activeProjects.map((p) => p.id)))
        .orderBy(asc(boardColumns.sortOrder))
    : [];
  const colsByProject: Record<string, ProjectOption['columns']> = {};
  for (const c of colRows) (colsByProject[c.projectId] ??= []).push({ id: c.id, name: c.name, color: c.color, isDone: c.isDone });

  const members = await db
    .select({ id: agencyUsers.id, name: agencyUsers.name })
    .from(agencyUsers)
    .where(and(eq(agencyUsers.agencyId, agencyId), eq(agencyUsers.status, 'active')));

  return {
    tasks: tasksOut,
    projects: activeProjects.map((p) => ({ id: p.id, name: p.name, columns: colsByProject[p.id] ?? [] })),
    members,
  };
}

const DEFAULT_TASK_COLUMNS = [
  { name: 'Zu erledigen', color: '#909090', isDone: false },
  { name: 'In Arbeit', color: '#3B82F6', isDone: false },
  { name: 'In Review', color: '#A855F7', isDone: false },
  { name: 'Erledigt', color: '#22C55E', isDone: true },
];

/**
 * Agency-wide task-board columns. Seeds the four defaults on first use and
 * backfills any tasks that lack a column (mapping the legacy status enum).
 */
export async function ensureTaskColumns(agencyId: string): Promise<TaskColumn[]> {
  const db = await getRequestDb();
  let cols = await db.select().from(taskColumns).where(eq(taskColumns.agencyId, agencyId)).orderBy(asc(taskColumns.sortOrder));
  if (cols.length === 0) {
    await db.insert(taskColumns).values(DEFAULT_TASK_COLUMNS.map((c, i) => ({ agencyId, name: c.name, color: c.color, isDone: c.isDone, sortOrder: i })));
    cols = await db.select().from(taskColumns).where(eq(taskColumns.agencyId, agencyId)).orderBy(asc(taskColumns.sortOrder));
  }
  // Backfill tasks lacking a column (map legacy status → column).
  const projIds = (await db.select({ id: projects.id }).from(projects).where(eq(projects.agencyId, agencyId))).map((p) => p.id);
  if (projIds.length) {
    const open = cols.find((c) => !c.isDone) ?? cols[0];
    const done = cols.find((c) => c.isDone) ?? cols[cols.length - 1];
    const active = cols.filter((c) => !c.isDone)[1] ?? open;
    const orphan = await db.select({ id: tasks.id, status: tasks.status })
      .from(tasks)
      .where(and(inArray(tasks.projectId, projIds), isNull(tasks.taskColumnId)));
    if (orphan.length) {
      const pick = (s: string) => (s === 'done' ? done.id : s === 'active' ? active.id : open.id);
      const byCol: Record<string, string[]> = {};
      for (const o of orphan) (byCol[pick(o.status)] ??= []).push(o.id);
      for (const [colId, ids] of Object.entries(byCol)) {
        await db.update(tasks).set({ taskColumnId: colId }).where(inArray(tasks.id, ids));
      }
    }
  }
  return cols;
}
