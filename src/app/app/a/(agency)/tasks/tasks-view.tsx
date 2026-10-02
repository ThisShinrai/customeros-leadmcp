'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, closestCorners, useDroppable,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, List, LayoutGrid, CalendarRange, CalendarDays, CheckSquare, AlignLeft,
  ChevronLeft, ChevronRight, ListTodo, Folder, Flag, User, CircleDashed, Inbox, ChevronDown,
  MoreHorizontal, Trash2, X,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, EmptyState, Field, Label, Input, Select, Textarea, Drawer, Modal, useToast } from '@/components/ui';
import { getInitials, formatDate } from '@/lib/utils';
import { PRIORITY_MAP, PRIORITIES, STATUS_LABEL, openTaskDrawer, type Priority } from './shared';
import type { AllTasksData, GlobalTask, ProjectOption, TaskColumn } from './queries';
import { createGlobalTask } from './actions';
import { createTaskColumn, updateTaskColumn, deleteTaskColumn, moveTaskToColumn } from './task-board-actions';

const E = 'cubic-bezier(.16,1,.3,1)';
type Status = 'open' | 'active' | 'done';
type View = 'list' | 'board' | 'calendar';
type GroupBy = 'project' | 'status' | 'priority' | 'assignee';

const VIEWS: { key: View; label: string; Icon: typeof List }[] = [
  { key: 'list', label: 'Liste', Icon: List },
  { key: 'board', label: 'Board', Icon: LayoutGrid },
  { key: 'calendar', label: 'Kalender', Icon: CalendarRange },
];

const VIEW_LS = 'cos-tasks-view';
function isView(v: unknown): v is View { return v === 'list' || v === 'board' || v === 'calendar'; }

const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: 'project', label: 'Projekt' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priorität' },
  { key: 'assignee', label: 'Zuständig' },
];

const STATUS_ORDER: Status[] = ['open', 'active', 'done'];
const UNASSIGNED = '__none__';
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** A bucket = one group (List) or one column (Board): a stable key + label + the dimension value to write on drop. */
interface Bucket { key: string; label: string; color?: string; value: string | null }

/** Stable (module-level) mapping of a task to its bucket key for the active grouping. */
function bucketKeyFor(groupBy: GroupBy, t: GlobalTask): string {
  switch (groupBy) {
    case 'status': return t.status;
    case 'priority': return t.priority;
    case 'project': return t.projectId;
    case 'assignee': return t.assigneeId ?? UNASSIGNED;
  }
}

/* ════════════════════════════ Root ════════════════════════════ */

export function TasksView({ data, taskColumns, canEdit }: { data: AllTasksData; taskColumns: TaskColumn[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();

  const [tasks, setTasks] = useState<GlobalTask[]>(data.tasks);
  // Resync local state when the server re-fetches (after a drawer/create edit +
  // router.refresh) — otherwise filters/cards run on stale priorities/values.
  const [dataRef, setDataRef] = useState(data.tasks);
  if (dataRef !== data.tasks) { setDataRef(data.tasks); setTasks(data.tasks); }
  const [view, setView] = useState<View>('list');
  // Persist the chosen view across navigation (read after mount → no SSR mismatch).
  useEffect(() => { try { const v = localStorage.getItem(VIEW_LS); if (isView(v)) setView(v); } catch { /* ignore */ } }, []);
  useEffect(() => { try { localStorage.setItem(VIEW_LS, view); } catch { /* ignore */ } }, [view]);
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [createOpen, setCreateOpen] = useState(false);

  // Filters (client-side).
  const [fProject, setFProject] = useState('');
  const [fPriority, setFPriority] = useState('');
  const [fAssignee, setFAssignee] = useState('');
  const [fStatus, setFStatus] = useState('');

  const projectName = (id: string) => data.projects.find((p) => p.id === id)?.name ?? '—';
  const memberName = (id: string | null) => (id ? data.members.find((m) => m.id === id)?.name ?? null : null);

  const filtered = useMemo(() => tasks.filter((t) =>
    (!fProject || t.projectId === fProject) &&
    (!fPriority || t.priority === fPriority) &&
    (!fAssignee || (fAssignee === UNASSIGNED ? !t.assigneeId : t.assigneeId === fAssignee)) &&
    (!fStatus || t.status === fStatus),
  ), [tasks, fProject, fPriority, fAssignee, fStatus]);

  /** Ordered buckets for the active grouping dimension. */
  const buckets = useMemo<Bucket[]>(() => {
    switch (groupBy) {
      case 'status':
        return STATUS_ORDER.map((s) => ({ key: s, label: STATUS_LABEL[s], value: s }));
      case 'priority':
        return PRIORITIES.map((p) => ({ key: p, label: PRIORITY_MAP[p].label, color: PRIORITY_MAP[p].color, value: p }));
      case 'project':
        return data.projects.map((p) => ({ key: p.id, label: p.name, value: p.id }));
      case 'assignee':
        return [
          ...data.members.map((m) => ({ key: m.id, label: m.name, value: m.id })),
          { key: UNASSIGNED, label: 'Nicht zugewiesen', value: null },
        ];
    }
  }, [groupBy, data.projects, data.members]);

  // Board drag/moves are handled inside <TaskBoard/> via moveTaskToColumn.

  const hasFilters = !!(fProject || fPriority || fAssignee || fStatus);
  const count = filtered.length;

  return (
    <>
      <Topbar title="Aufgaben" subtitle={`${tasks.length} ${tasks.length === 1 ? 'Aufgabe' : 'Aufgaben'}`} />

      <div style={{ padding: '20px 24px 56px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ── Toolbar ── */}
        <div className="tk-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ViewSwitch view={view} onChange={setView} />

          {view === 'list' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--faint)', whiteSpace: 'nowrap' }}>Gruppieren:</span>
              <NativeSelect value={groupBy} onChange={(v) => setGroupBy(v as GroupBy)} icon={<LayoutGrid size={13} />}>
                {GROUP_OPTIONS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </NativeSelect>
            </div>
          )}

          {view !== 'calendar' && (
          <div className="tk-filters" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            <NativeSelect value={fProject} onChange={setFProject} icon={<Folder size={13} />} muted={!fProject}>
              <option value="">Alle Projekte</option>
              {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </NativeSelect>
            <NativeSelect value={fPriority} onChange={setFPriority} icon={<Flag size={13} />} muted={!fPriority}>
              <option value="">Alle Prioritäten</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_MAP[p].label}</option>)}
            </NativeSelect>
            <NativeSelect value={fAssignee} onChange={setFAssignee} icon={<User size={13} />} muted={!fAssignee}>
              <option value="">Alle Zuständigen</option>
              {data.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              <option value={UNASSIGNED}>Nicht zugewiesen</option>
            </NativeSelect>
            <NativeSelect value={fStatus} onChange={setFStatus} icon={<CircleDashed size={13} />} muted={!fStatus}>
              <option value="">Alle Status</option>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </NativeSelect>
            {hasFilters && (
              <button onClick={() => { setFProject(''); setFPriority(''); setFAssignee(''); setFStatus(''); }}
                style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--faint)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 4px', whiteSpace: 'nowrap' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--faint)'; }}>
                Zurücksetzen
              </button>
            )}
          </div>
          )}

          {canEdit && (
            <button onClick={() => setCreateOpen(true)} style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--accent)', color: '#fff',
              borderRadius: 100, padding: '9px 16px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: `transform .14s ${E}`,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
              <Plus size={15} /> Neue Aufgabe
            </button>
          )}
        </div>

        {/* ── Body ── */}
        {view === 'board' ? (
          <TaskBoard columns={taskColumns} tasks={filtered} projectName={projectName} memberName={memberName} canEdit={canEdit} />
        ) : tasks.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18 }}>
            <EmptyState
              icon={<ListTodo size={24} />}
              title="Noch keine Aufgaben"
              description="Erstellen Sie Ihre erste Aufgabe, um den Überblick über alle Projekte hinweg zu behalten."
              action={canEdit ? <Button icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>Erste Aufgabe erstellen</Button> : undefined}
            />
          </div>
        ) : count === 0 ? (
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18 }}>
            <EmptyState icon={<Inbox size={24} />} title="Keine Treffer" description="Keine Aufgaben passen zu den aktuellen Filtern. Passen Sie die Filter an." />
          </div>
        ) : view === 'list' ? (
          <ListView buckets={buckets} groupBy={groupBy} tasks={filtered} projectName={projectName} memberName={memberName} />
        ) : (
          <CalendarView tasks={filtered} projectName={projectName} />
        )}
      </div>

      {createOpen && (
        <CreateTaskDrawer
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          projects={data.projects}
          members={data.members}
          onCreated={() => { setCreateOpen(false); router.refresh(); }}
        />
      )}

      <style>{`
        .tk-scroll::-webkit-scrollbar { height: 8px; }
        .tk-scroll::-webkit-scrollbar-thumb { background: var(--pale); border-radius: 100px; }
        .tk-row:hover { background: var(--wash); }
        .tk-card .tk-card-grip { cursor: grab; }
        @media (max-width: 760px) {
          .tk-toolbar > button[style*="margin-left"] { margin-left: 0 !important; width: 100%; justify-content: center; }
          .tk-filters { width: 100%; }
        }
      `}</style>
    </>
  );
}

/* ════════════════════════════ Toolbar atoms ════════════════════════════ */

function ViewSwitch({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--wash)', borderRadius: 9, padding: 3, gap: 2 }}>
      {VIEWS.map(({ key, label, Icon }) => {
        const active = view === key;
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
            fontSize: 12.5, fontWeight: 600, transition: `background .18s ${E}, color .18s ${E}`,
            background: active ? '#fff' : 'transparent', color: active ? 'var(--black)' : 'var(--faint)',
            boxShadow: active ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
          }}>
            <Icon size={13} /> {label}
          </button>
        );
      })}
    </div>
  );
}

/** Compact pill-shaped native <select> with a leading icon — looks bespoke, behaves native. */
function NativeSelect({ value, onChange, children, icon, muted }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; icon?: React.ReactNode; muted?: boolean;
}) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {icon && <span style={{ position: 'absolute', left: 11, display: 'flex', color: 'var(--faint)', pointerEvents: 'none' }}>{icon}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
          height: 34, padding: icon ? '0 30px 0 31px' : '0 30px 0 13px', borderRadius: 100,
          border: '1.5px solid var(--line)', background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12.5, fontWeight: 600, color: muted ? 'var(--mid)' : 'var(--ink)',
          maxWidth: 200, textOverflow: 'ellipsis', transition: `border-color .16s ${E}`,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; }}
      >
        {children}
      </select>
      <ChevronDown size={13} style={{ position: 'absolute', right: 10, color: 'var(--faint)', pointerEvents: 'none' }} />
    </span>
  );
}

/* ════════════════════════════ Shared task bits ════════════════════════════ */

function PriorityDot({ priority, size = 9 }: { priority: Priority; size?: number }) {
  const p = PRIORITY_MAP[priority];
  return <span title={p.label} style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: p.color, boxShadow: priority === 'none' ? 'inset 0 0 0 1px var(--pale)' : 'none' }} />;
}

function ProjectPill({ projectId, name }: { projectId: string; name: string }) {
  return (
    <Link
      href={`/app/a/projects/${projectId}`}
      onClick={(e) => e.stopPropagation()}
      title={`Projekt öffnen: ${name}`}
      style={{
        display: 'inline-flex', alignItems: 'center', maxWidth: 160, fontSize: 11, fontWeight: 600, color: 'var(--mid)',
        background: 'var(--wash)', borderRadius: 100, padding: '2px 9px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        textDecoration: 'none', transition: `background .14s ${E}, color .14s ${E}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--black)'; e.currentTarget.style.color = '#fff'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--wash)'; e.currentTarget.style.color = 'var(--mid)'; }}
    >{name}</Link>
  );
}

function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <span title={name} style={{
      width: size, height: size, borderRadius: '50%', background: 'var(--black)', color: '#fff',
      fontSize: size < 22 ? 8.5 : 9.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{getInitials(name)}</span>
  );
}

function isOverdue(due: number | null, status: Status) {
  if (!due || status === 'done') return false;
  const d = new Date(due); d.setHours(23, 59, 59, 999);
  return d.getTime() < Date.now();
}

/* ════════════════════════════ LIST view ════════════════════════════ */

function ListView({ buckets, groupBy, tasks, projectName, memberName }: {
  buckets: Bucket[]; groupBy: GroupBy; tasks: GlobalTask[];
  projectName: (id: string) => string; memberName: (id: string | null) => string | null;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, GlobalTask[]> = {};
    for (const b of buckets) map[b.key] = [];
    for (const t of tasks) (map[bucketKeyFor(groupBy, t)] ??= []).push(t);
    return map;
  }, [buckets, groupBy, tasks]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {buckets.map((b) => {
        const list = grouped[b.key] ?? [];
        if (list.length === 0) return null;
        return (
          <section key={b.key} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 18px', borderBottom: '1px solid var(--line)' }}>
              {b.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, flexShrink: 0 }} />}
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--black)', letterSpacing: '-0.2px' }}>{b.label}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--faint)', background: 'var(--wash)', borderRadius: 100, padding: '1px 8px' }}>{list.length}</span>
            </header>
            <div>
              {list.map((t, i) => (
                <ListRow key={t.id} task={t} projectName={projectName} memberName={memberName} last={i === list.length - 1} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ListRow({ task, projectName, memberName, last }: {
  task: GlobalTask; projectName: (id: string) => string; memberName: (id: string | null) => string | null; last: boolean;
}) {
  const assignee = memberName(task.assigneeId);
  const overdue = isOverdue(task.dueDate, task.status);
  const done = task.status === 'done';
  return (
    <div
      className="tk-row"
      onClick={() => openTaskDrawer(task.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '10px 18px', cursor: 'pointer',
        borderBottom: last ? 'none' : '1px solid var(--line)', transition: `background .14s ${E}`, minWidth: 0,
      }}
    >
      <PriorityDot priority={task.priority} />
      <span style={{
        flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, color: done ? 'var(--faint)' : 'var(--ink)',
        textDecoration: done ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{task.title}</span>

      {task.hasDescription && <AlignLeft size={13} style={{ color: 'var(--pale)', flexShrink: 0 }} aria-label="Beschreibung" />}
      {task.subtaskTotal > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: task.subtaskDone === task.subtaskTotal ? '#16A34A' : 'var(--faint)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          <CheckSquare size={12} /> {task.subtaskDone}/{task.subtaskTotal}
        </span>
      )}

      <span className="tk-hide-sm" style={{ flexShrink: 0 }}><ProjectPill projectId={task.projectId} name={projectName(task.projectId)} /></span>

      {task.dueDate && (
        <span className="tk-hide-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 500, color: overdue ? '#DC2626' : 'var(--faint)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <CalendarDays size={12} /> {formatDate(task.dueDate)}
        </span>
      )}

      {assignee ? <Avatar name={assignee} /> : <span style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px dashed var(--pale)', flexShrink: 0 }} />}

      <style>{`@media (max-width: 640px) { .tk-hide-sm { display: none !important; } }`}</style>
    </div>
  );
}

/* ════════════════════════════ BOARD view ════════════════════════════ */

const COL_PALETTE = ['#909090', '#3B82F6', '#22C55E', '#F59E0B', '#A855F7', '#EF4444', '#EC4899', '#14B8A6', '#F97316', '#0A0A0A'];

/** The agency-wide tasks board: one board, custom columns, cards are real tasks. */
function TaskBoard({ columns, tasks, projectName, memberName, canEdit }: {
  columns: TaskColumn[]; tasks: GlobalTask[];
  projectName: (id: string) => string; memberName: (id: string | null) => string | null; canEdit: boolean;
}) {
  const toast = useToast();

  // Group tasks by column (orphans fall into the first column); ordered by boardSort.
  const initial = useMemo(() => {
    const map: Record<string, GlobalTask[]> = {};
    for (const c of columns) map[c.id] = [];
    const firstId = columns[0]?.id;
    for (const t of [...tasks].sort((a, b) => a.boardSort - b.boardSort)) {
      const key = t.taskColumnId && map[t.taskColumnId] ? t.taskColumnId : firstId;
      if (key) (map[key] ??= []).push(t);
    }
    return map;
  }, [columns, tasks]);

  const [byCol, setByCol] = useState(initial);
  const [snapshot, setSnapshot] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  if (snapshot !== initial) { setSnapshot(initial); setByCol(initial); }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const list of Object.values(byCol)) { const t = list.find((x) => x.id === activeId); if (t) return t; }
    return null;
  }, [activeId, byCol]);

  function findContainer(id: string): string | null {
    if (id in byCol) return id;
    return Object.keys(byCol).find((k) => byCol[k].some((t) => t.id === id)) ?? null;
  }
  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }
  function onDragOver(e: DragOverEvent) {
    const aId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = findContainer(aId);
    const to = findContainer(overId);
    if (!from || !to || from === to) return;
    setByCol((prev) => {
      const fromItems = prev[from];
      const toItems = prev[to];
      const moving = fromItems.find((t) => t.id === aId);
      if (!moving) return prev;
      const overIndex = overId in prev ? toItems.length : toItems.findIndex((t) => t.id === overId);
      const insertAt = overIndex < 0 ? toItems.length : overIndex;
      return {
        ...prev,
        [from]: fromItems.filter((t) => t.id !== aId),
        [to]: [...toItems.slice(0, insertAt), moving, ...toItems.slice(insertAt)],
      };
    });
  }
  function onDragEnd(e: DragEndEvent) {
    const aId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setActiveId(null);
    if (!overId) return;
    const container = findContainer(aId);
    if (!container) return;
    let items = byCol[container];
    const oldIndex = items.findIndex((t) => t.id === aId);
    const newIndex = overId in byCol ? items.length - 1 : items.findIndex((t) => t.id === overId);
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      items = arrayMove(items, oldIndex, newIndex);
      setByCol((prev) => ({ ...prev, [container]: items }));
    }
    const ordered = items.map((t) => t.id);
    void moveTaskToColumn(aId, container, ordered).catch(() => toast.error('Verschieben fehlgeschlagen.'));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className="tk-scroll" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8 }}>
        {columns.map((c) => (
          <TaskBoardColumn
            key={c.id} column={c} tasks={byCol[c.id] ?? []}
            projectName={projectName} memberName={memberName} canEdit={canEdit} canDelete={columns.length > 1}
          />
        ))}
        {canEdit && <AddColumn />}
      </div>

      {typeof document !== 'undefined' && createPortal(
        <DragOverlay dropAnimation={{ duration: 200, easing: E }}>
          {activeTask ? <CardShell task={activeTask} projectName={projectName} memberName={memberName} dragging /> : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

function TaskBoardColumn({ column, tasks, projectName, memberName, canEdit, canDelete }: {
  column: TaskColumn; tasks: GlobalTask[]; projectName: (id: string) => string; memberName: (id: string | null) => string | null;
  canEdit: boolean; canDelete: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: !canEdit });
  const [settings, setSettings] = useState(false);
  const accent = column.color || 'var(--pale)';
  return (
    <div style={{ flexShrink: 0, width: 286, display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 10px' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: accent, flexShrink: 0, boxShadow: '0 0 0 1px var(--line)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--black)', letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{column.name}</span>
        {column.isDone && <CheckSquare size={12} style={{ color: '#16A34A', flexShrink: 0 }} />}
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--faint)', background: 'var(--wash)', borderRadius: 100, padding: '1px 8px', flexShrink: 0 }}>{tasks.length}</span>
        {canEdit && (
          <button onClick={() => setSettings(true)} aria-label="Spalte bearbeiten" style={{ width: 24, height: 24, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <MoreHorizontal size={15} />
          </button>
        )}
      </div>
      <div style={{ height: 3, borderRadius: 3, background: accent, marginBottom: 10, flexShrink: 0 }} />

      <div
        ref={setNodeRef}
        style={{
          flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', padding: 2,
          borderRadius: 12, background: isOver ? 'rgba(var(--accent-rgb),.06)' : 'transparent', transition: `background .16s ${E}`,
        }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} projectName={projectName} memberName={memberName} dragEnabled={canEdit} hideProject={false} />
          ))}
        </SortableContext>
        {tasks.length === 0 && <div style={{ fontSize: 12, color: 'var(--pale)', textAlign: 'center', padding: '14px 0' }}>Leer</div>}
      </div>

      {settings && <ColumnSettingsModal column={column} canDelete={canDelete} onClose={() => setSettings(false)} />}
    </div>
  );
}

function ColumnSettingsModal({ column, canDelete, onClose }: { column: TaskColumn; canDelete: boolean; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(column.name);
  const [color, setColor] = useState(column.color);
  const [isDone, setIsDone] = useState(column.isDone);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = name.trim();
    if (!n) { toast.error('Name darf nicht leer sein.'); return; }
    setSaving(true);
    try { await updateTaskColumn(column.id, { name: n, color, isDone }); onClose(); }
    catch { toast.error('Speichern fehlgeschlagen.'); setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Spalte bearbeiten" width={400}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button onClick={save} loading={saving}>Speichern</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <div>
          <Label>Farbe</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 6 }}>
            {COL_PALETTE.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={c}
                style={{ height: 30, borderRadius: 8, background: c, border: color.toLowerCase() === c.toLowerCase() ? '2px solid var(--black)' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13.5, color: 'var(--ink)' }}>
          <input type="checkbox" checked={isDone} onChange={(e) => setIsDone(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
          Aufgaben hier gelten als <strong>erledigt</strong>
        </label>
        {canDelete && (
          confirmDel ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--ink)' }}>Spalte wirklich löschen?</span>
              <Button size="sm" variant="danger" onClick={async () => { try { await deleteTaskColumn(column.id); onClose(); } catch { toast.error('Löschen fehlgeschlagen.'); } }}>Löschen</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}>Abbrechen</Button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDel(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 9, border: 'none', background: 'rgba(239,68,68,.08)', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Trash2 size={14} /> Spalte löschen
            </button>
          )
        )}
      </div>
    </Modal>
  );
}

function AddColumn() {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  async function add() {
    const n = name.trim();
    if (!n) { setAdding(false); return; }
    setName(''); setAdding(false);
    try { await createTaskColumn(n); } catch { toast.error('Spalte konnte nicht erstellt werden.'); }
  }
  return (
    <div style={{ flexShrink: 0, width: 286 }}>
      {adding ? (
        <div style={{ background: 'var(--wash)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }} placeholder="Spalten-Name…" style={{ fontSize: 13, border: '1px solid var(--line)', borderRadius: 9, padding: '8px 10px', fontFamily: 'inherit', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={add} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: 'var(--black)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Hinzufügen</button>
            <button onClick={() => setAdding(false)} aria-label="Abbrechen" style={{ width: 32, borderRadius: 8, border: '1px solid var(--line)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={15} /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px dashed var(--line)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--mid)' }}>
          <Plus size={15} /> Spalte
        </button>
      )}
    </div>
  );
}

function SortableCard({ task, projectName, memberName, dragEnabled, hideProject }: {
  task: GlobalTask; projectName: (id: string) => string; memberName: (id: string | null) => string | null; dragEnabled: boolean; hideProject: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !dragEnabled });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(dragEnabled ? listeners : {})}>
      <CardShell task={task} projectName={projectName} memberName={memberName} hideProject={hideProject} grabbable={dragEnabled} />
    </div>
  );
}

function CardShell({ task, projectName, memberName, dragging, hideProject, grabbable }: {
  task: GlobalTask; projectName: (id: string) => string; memberName: (id: string | null) => string | null;
  dragging?: boolean; hideProject?: boolean; grabbable?: boolean;
}) {
  const assignee = memberName(task.assigneeId);
  const overdue = isOverdue(task.dueDate, task.status);
  return (
    <div
      className="tk-card"
      onClick={() => { if (!dragging) openTaskDrawer(task.id); }}
      style={{
        background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 12px',
        boxShadow: dragging ? '0 16px 40px rgba(0,0,0,.18)' : '0 1px 2px rgba(0,0,0,.04)',
        cursor: grabbable ? 'grab' : 'pointer', display: 'flex', flexDirection: 'column', gap: 9,
        transform: dragging ? 'rotate(2deg)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ marginTop: 4 }}><PriorityDot priority={task.priority} /></span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35, wordBreak: 'break-word', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
        {task.hasDescription && <AlignLeft size={13} style={{ color: 'var(--pale)', flexShrink: 0, marginTop: 3 }} />}
      </div>

      {!hideProject && <div><ProjectPill projectId={task.projectId} name={projectName(task.projectId)} /></div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          {task.dueDate ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: overdue ? '#DC2626' : 'var(--faint)', whiteSpace: 'nowrap' }}>
              <CalendarDays size={12} /> {formatDate(task.dueDate)}
            </span>
          ) : <span />}
          {task.subtaskTotal > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: task.subtaskDone === task.subtaskTotal ? '#16A34A' : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
              <CheckSquare size={11} /> {task.subtaskDone}/{task.subtaskTotal}
            </span>
          )}
        </div>
        {assignee && <Avatar name={assignee} />}
      </div>
    </div>
  );
}

/* ════════════════════════════ KALENDER view ════════════════════════════ */

function startOfMonth(y: number, m: number) { return new Date(y, m, 1); }
function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

function CalendarView({ tasks, projectName }: { tasks: GlobalTask[]; projectName: (id: string) => string }) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));

  // 6 weeks (42 cells) starting on Monday before/at the 1st.
  const cells = useMemo(() => {
    const first = startOfMonth(cursor.y, cursor.m);
    const offset = (first.getDay() + 6) % 7; // Mon=0
    const start = new Date(cursor.y, cursor.m, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [cursor]);

  const { byDay, undated } = useMemo(() => {
    const map: Record<string, GlobalTask[]> = {};
    const none: GlobalTask[] = [];
    for (const t of tasks) {
      if (t.dueDate == null) { none.push(t); continue; }
      const k = dayKey(new Date(t.dueDate));
      (map[k] ??= []).push(t);
    }
    return { byDay: map, undated: none };
  }, [tasks]);

  const todayKey = dayKey(today);
  const go = (dir: -1 | 1) => setCursor((c) => {
    const m = c.m + dir;
    if (m < 0) return { y: c.y - 1, m: 11 };
    if (m > 11) return { y: c.y + 1, m: 0 };
    return { y: c.y, m };
  });

  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 16 }}>
      {/* Month header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--black)', margin: 0 }}>
          {MONTHS[cursor.m]} {cursor.y}
        </h2>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })} style={{
            height: 32, padding: '0 13px', borderRadius: 100, border: '1.5px solid var(--line)', background: '#fff',
            fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', transition: `background .14s ${E}`,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--wash)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}>
            Heute
          </button>
          <NavBtn onClick={() => go(-1)} label="Vorheriger Monat"><ChevronLeft size={16} /></NavBtn>
          <NavBtn onClick={() => go(1)} label="Nächster Monat"><ChevronRight size={16} /></NavBtn>
        </div>
      </div>

      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
        {WEEKDAYS.map((d) => (
          <div key={d} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--faint)', textAlign: 'center', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* 6×7 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(96px, auto)', gap: 6 }}>
        {cells.map((d) => {
          const inMonth = d.getMonth() === cursor.m;
          const k = dayKey(d);
          const isToday = k === todayKey;
          const dayTasks = byDay[k] ?? [];
          return (
            <div key={k} style={{
              border: isToday ? '1.5px solid var(--accent)' : '1px solid var(--line)', borderRadius: 12, padding: 7,
              background: inMonth ? '#fff' : 'var(--wash)', opacity: inMonth ? 1 : 0.6,
              display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{
                  fontSize: 11.5, fontWeight: isToday ? 800 : 600, fontVariantNumeric: 'tabular-nums',
                  color: isToday ? '#fff' : inMonth ? 'var(--ink)' : 'var(--faint)',
                  background: isToday ? 'var(--accent)' : 'transparent', minWidth: 18, height: 18, borderRadius: 100,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                }}>{d.getDate()}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                {dayTasks.slice(0, 3).map((t) => <CalChip key={t.id} task={t} projectName={projectName} />)}
                {dayTasks.length > 3 && <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--faint)', paddingLeft: 2 }}>+{dayTasks.length - 3} weitere</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Undated row */}
      {undated.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--faint)', marginBottom: 10 }}>Ohne Datum · {undated.length}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {undated.map((t) => <CalChip key={t.id} task={t} projectName={projectName} block />)}
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} style={{
      width: 32, height: 32, borderRadius: 9, border: '1.5px solid var(--line)', background: '#fff', color: 'var(--mid)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: `background .14s ${E}, color .14s ${E}`,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--black)'; e.currentTarget.style.color = '#fff'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = 'var(--mid)'; }}>
      {children}
    </button>
  );
}

function CalChip({ task, projectName, block }: { task: GlobalTask; projectName: (id: string) => string; block?: boolean }) {
  const color = PRIORITY_MAP[task.priority].color;
  const done = task.status === 'done';
  return (
    <button
      onClick={() => openTaskDrawer(task.id)}
      title={`${task.title} · ${projectName(task.projectId)}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: block ? 220 : '100%', width: block ? undefined : '100%',
        textAlign: 'left', background: 'var(--wash)', border: 'none', borderRadius: 7, padding: '3px 7px 3px 6px', cursor: 'pointer',
        borderLeft: `3px solid ${color}`, transition: `background .14s ${E}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--line)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--wash)'; }}
    >
      <span style={{
        fontSize: 11, fontWeight: 600, color: done ? 'var(--faint)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
      }}>{task.title}</span>
    </button>
  );
}

/* ════════════════════════════ Create drawer ════════════════════════════ */

function CreateTaskDrawer({ open, onClose, projects, members, onCreated }: {
  open: boolean; onClose: () => void;
  projects: ProjectOption[]; members: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const toast = useToast();
  const [projectId, setProjectId] = useState('');
  const [columnId, setColumnId] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('none');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedProject = projects.find((p) => p.id === projectId);

  async function submit() {
    if (!projectId) { toast.error('Bitte ein Projekt wählen.'); return; }
    if (!title.trim()) { toast.error('Bitte einen Titel eingeben.'); return; }
    setSaving(true);
    try {
      await createGlobalTask({
        projectId,
        columnId: columnId || undefined,
        title: title.trim(),
        priority,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate || undefined,
        description: description.trim() || undefined,
      });
      toast.success('Aufgabe erstellt.');
      onCreated();
    } catch {
      toast.error('Aufgabe konnte nicht erstellt werden.');
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      width={460}
      title="Neue Aufgabe"
      subtitle="Erstellen Sie eine Aufgabe in einem beliebigen Projekt."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Abbrechen</Button>
          <Button size="sm" icon={<Plus size={14} />} loading={saving} onClick={submit}>Aufgabe erstellen</Button>
        </>
      }
    >
      <Field label="Projekt">
        <Select value={projectId} onChange={(e) => { const v = e.target.value; setProjectId(v); setColumnId(projects.find((p) => p.id === v)?.columns[0]?.id ?? ''); }}>
          <option value="" disabled>Projekt wählen…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>

      {selectedProject && selectedProject.columns.length > 0 && (
        <Field label="Spalte / Status">
          <Select value={columnId} onChange={(e) => setColumnId(e.target.value)}>
            {selectedProject.columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      )}

      <Field label="Titel">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Was ist zu tun?"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Priorität" style={{ marginBottom: 16 }}>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_MAP[p].label}</option>)}
          </Select>
        </Field>
        <Field label="Fällig" style={{ marginBottom: 16 }}>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Zuständig">
        <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Nicht zugewiesen</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </Field>

      <Field label="Beschreibung" style={{ marginBottom: 0 }}>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optionale Details…" rows={4} />
      </Field>
      <Label style={{ marginTop: 18, marginBottom: 0, textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: 'var(--faint)' }}>
        Die Aufgabe landet in der ersten Board-Spalte des Projekts.
      </Label>
    </Drawer>
  );
}
