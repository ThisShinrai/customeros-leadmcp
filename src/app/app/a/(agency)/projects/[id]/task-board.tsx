'use client';

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, closestCorners, useDroppable,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, MoreHorizontal, Trash2, Check, Pencil, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Circle,
  CheckSquare, AlignLeft,
} from 'lucide-react';
import { DropdownMenu, useToast } from '@/components/ui';
import { getInitials, formatDate } from '@/lib/utils';
import { createColumn, updateColumn, deleteColumn, reorderColumns, createBoardTask, moveTask } from './board-actions';
import { deleteTask, updateTask } from '../actions';
import { openTaskDrawer, PRIORITY_MAP, type Priority } from '../../tasks/shared';

const E = 'cubic-bezier(.16,1,.3,1)';
const PALETTE = ['#909090', '#0A0A0A', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#A855F7', '#EC4899', '#14B8A6', '#F97316'];

export interface BoardTask { id: string; title: string; columnId: string | null; dueDate: number | null; assigneeId: string | null; priority: Priority; subtaskDone: number; subtaskTotal: number; hasDescription: boolean }
export interface BoardCol { id: string; name: string; color: string; isDone: boolean }
interface Member { id: string; name: string; role: string }

function group(cols: BoardCol[], tasks: BoardTask[]): Record<string, BoardTask[]> {
  const map: Record<string, BoardTask[]> = {};
  for (const c of cols) map[c.id] = [];
  for (const t of tasks) {
    const cid = t.columnId && map[t.columnId] ? t.columnId : cols[0]?.id;
    if (cid && map[cid]) map[cid].push(t);
  }
  return map;
}

export function TaskBoard({ projectId, initialColumns, initialTasks, members, canEdit }: {
  projectId: string; initialColumns: BoardCol[]; initialTasks: BoardTask[]; members: Member[]; canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [columns, setColumns] = useState<BoardCol[]>(initialColumns);
  const [byCol, setByCol] = useState<Record<string, BoardTask[]>>(() => group(initialColumns, initialTasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const memberName = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? null : null);
  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const list of Object.values(byCol)) { const t = list.find((x) => x.id === activeId); if (t) return t; }
    return null;
  }, [activeId, byCol]);

  function findContainer(id: string): string | null {
    if (id in byCol) return id;
    return Object.keys(byCol).find((cid) => byCol[cid].some((t) => t.id === id)) ?? null;
  }

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }

  function onDragOver(e: DragOverEvent) {
    const activeIdL = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = findContainer(activeIdL);
    const to = findContainer(overId);
    if (!from || !to || from === to) return;
    setByCol((prev) => {
      const fromItems = prev[from];
      const toItems = prev[to];
      const moving = fromItems.find((t) => t.id === activeIdL);
      if (!moving) return prev;
      const overIndex = overId in prev ? toItems.length : toItems.findIndex((t) => t.id === overId);
      const insertAt = overIndex < 0 ? toItems.length : overIndex;
      return {
        ...prev,
        [from]: fromItems.filter((t) => t.id !== activeIdL),
        [to]: [...toItems.slice(0, insertAt), { ...moving, columnId: to }, ...toItems.slice(insertAt)],
      };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const activeIdL = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setActiveId(null);
    if (!overId) return;
    const container = findContainer(activeIdL);
    if (!container) return;
    let finalItems = byCol[container];
    const oldIndex = finalItems.findIndex((t) => t.id === activeIdL);
    const newIndex = overId in byCol ? finalItems.length - 1 : finalItems.findIndex((t) => t.id === overId);
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      finalItems = arrayMove(finalItems, oldIndex, newIndex);
      setByCol((prev) => ({ ...prev, [container]: finalItems }));
    }
    moveTask(activeIdL, container, finalItems.map((t) => t.id)).catch(() => { toast.error('Verschieben fehlgeschlagen.'); router.refresh(); });
  }

  /* ── column ops ── */
  async function addColumn() {
    const name = newColName.trim();
    if (!name) { setAddingCol(false); return; }
    const color = PALETTE[(columns.length + 2) % PALETTE.length];
    setNewColName(''); setAddingCol(false);
    try {
      const col = await createColumn(projectId, name, color);
      const bc: BoardCol = { id: col.id, name: col.name, color: col.color, isDone: col.isDone };
      setColumns((c) => [...c, bc]);
      setByCol((m) => ({ ...m, [col.id]: [] }));
    } catch { toast.error('Spalte konnte nicht erstellt werden.'); }
  }
  function patchColumn(id: string, patch: Partial<BoardCol>) {
    setColumns((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    updateColumn(id, patch).catch(() => { toast.error('Spalte konnte nicht gespeichert werden.'); router.refresh(); });
  }
  function removeColumn(id: string) {
    if (columns.length <= 1) { toast.error('Mindestens eine Spalte muss bleiben.'); return; }
    const idx = columns.findIndex((c) => c.id === id);
    const target = columns[idx === 0 ? 1 : idx - 1];
    setByCol((m) => {
      const moved = m[id] ?? [];
      const next = { ...m, [target.id]: [...m[target.id], ...moved] };
      delete next[id];
      return next;
    });
    setColumns((cs) => cs.filter((c) => c.id !== id));
    deleteColumn(id).catch(() => { toast.error('Spalte konnte nicht gelöscht werden.'); router.refresh(); });
  }
  function moveColumn(id: string, dir: -1 | 1) {
    const idx = columns.findIndex((c) => c.id === id);
    const to = idx + dir;
    if (to < 0 || to >= columns.length) return;
    const next = arrayMove(columns, idx, to);
    setColumns(next);
    reorderColumns(projectId, next.map((c) => c.id)).catch(() => { toast.error('Reihenfolge fehlgeschlagen.'); router.refresh(); });
  }

  /* ── card ops ── */
  async function addCard(columnId: string, title: string) {
    const t = title.trim();
    if (!t) return;
    try {
      const created = await createBoardTask({ projectId, columnId, title: t });
      const bt: BoardTask = { id: created.id, title: created.title, columnId, dueDate: created.dueDate, assigneeId: created.assigneeId, priority: 'none', subtaskDone: 0, subtaskTotal: 0, hasDescription: false };
      setByCol((m) => ({ ...m, [columnId]: [...m[columnId], bt] }));
    } catch { toast.error('Karte konnte nicht erstellt werden.'); }
  }
  function removeCard(columnId: string, id: string) {
    setByCol((m) => ({ ...m, [columnId]: m[columnId].filter((t) => t.id !== id) }));
    deleteTask(id).catch(() => { toast.error('Karte konnte nicht gelöscht werden.'); router.refresh(); });
  }
  function renameCard(columnId: string, id: string, title: string) {
    const t = title.trim();
    if (!t) return;
    setByCol((m) => ({ ...m, [columnId]: m[columnId].map((x) => (x.id === id ? { ...x, title: t } : x)) }));
    updateTask({ id, title: t }).catch(() => { toast.error('Karte konnte nicht gespeichert werden.'); router.refresh(); });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className="kb-scroll" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8 }}>
        {columns.map((col, i) => (
          <Column
            key={col.id}
            col={col}
            tasks={byCol[col.id] ?? []}
            members={members}
            memberName={memberName}
            canEdit={canEdit}
            isFirst={i === 0}
            isLast={i === columns.length - 1}
            onPatch={patchColumn}
            onRemove={removeColumn}
            onMove={moveColumn}
            onAddCard={addCard}
            onRemoveCard={removeCard}
            onRenameCard={renameCard}
          />
        ))}

        {canEdit && (
          <div style={{ flexShrink: 0, width: 280 }}>
            {addingCol ? (
              <div style={{ background: 'var(--wash)', borderRadius: 16, padding: 10 }}>
                <input
                  autoFocus
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') { setAddingCol(false); setNewColName(''); } }}
                  onBlur={addColumn}
                  placeholder="Spaltenname…"
                  className="cos-input"
                  style={{ padding: '9px 11px', fontSize: 13.5 }}
                />
              </div>
            ) : (
              <button
                onClick={() => setAddingCol(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', borderRadius: 16,
                  border: '1.5px dashed var(--line)', background: 'transparent', color: 'var(--faint)', cursor: 'pointer',
                  fontSize: 13.5, fontWeight: 600, transition: `color .16s ${E}, border-color .16s ${E}, background .16s ${E}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--faint)'; }}
              >
                <Plus size={16} /> Spalte hinzufügen
              </button>
            )}
          </div>
        )}
      </div>

      {typeof document !== 'undefined' && createPortal(
        <DragOverlay dropAnimation={{ duration: 200, easing: E }}>
          {activeTask ? <CardShell task={activeTask} memberName={memberName} dragging /> : null}
        </DragOverlay>,
        document.body,
      )}

      <style>{`
        .kb-scroll::-webkit-scrollbar { height: 8px; }
        .kb-scroll::-webkit-scrollbar-thumb { background: var(--pale); border-radius: 100px; }
        .kb-card .kb-card-actions { opacity: 0; transition: opacity .14s ${E}; }
        .kb-card:hover .kb-card-actions { opacity: 1; }
      `}</style>
    </DndContext>
  );
}

/* ───────────────────────── Column ───────────────────────── */
function Column({ col, tasks, members, memberName, canEdit, isFirst, isLast, onPatch, onRemove, onMove, onAddCard, onRemoveCard, onRenameCard }: {
  col: BoardCol; tasks: BoardTask[]; members: Member[]; memberName: (id: string | null) => string | null; canEdit: boolean;
  isFirst: boolean; isLast: boolean;
  onPatch: (id: string, patch: Partial<BoardCol>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onAddCard: (columnId: string, title: string) => void;
  onRemoveCard: (columnId: string, id: string) => void;
  onRenameCard: (columnId: string, id: string, title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(col.name);
  const [palette, setPalette] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  function commitAdd() {
    if (newTitle.trim()) onAddCard(col.id, newTitle);
    setNewTitle(''); setAdding(false);
  }

  return (
    <div style={{ flexShrink: 0, width: 280, display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 10px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => canEdit && setPalette((p) => !p)}
            aria-label="Farbe"
            style={{ width: 12, height: 12, borderRadius: '50%', background: col.color, border: '2px solid #fff', boxShadow: '0 0 0 1px var(--line)', cursor: canEdit ? 'pointer' : 'default', display: 'block' }}
          />
          {palette && (
            <>
              <div onClick={() => setPalette(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
              <div style={{ position: 'absolute', top: 20, left: 0, zIndex: 31, background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 8, boxShadow: '0 12px 32px rgba(0,0,0,.16)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, width: 168 }}>
                {PALETTE.map((c) => (
                  <button key={c} onClick={() => { onPatch(col.id, { color: c }); setPalette(false); }} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: col.color === c ? '2px solid var(--black)' : '2px solid #fff', boxShadow: '0 0 0 1px var(--line)', cursor: 'pointer' }} />
                ))}
              </div>
            </>
          )}
        </div>

        {editingName && canEdit ? (
          <input
            autoFocus value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { setEditingName(false); if (name.trim() && name !== col.name) onPatch(col.id, { name: name.trim() }); else setName(col.name); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setName(col.name); setEditingName(false); } }}
            className="cos-input" style={{ padding: '4px 8px', fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0 }}
          />
        ) : (
          <button
            onClick={() => canEdit && setEditingName(true)}
            style={{ flex: 1, minWidth: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: canEdit ? 'text' : 'default', padding: 0 }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--black)', letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.name}</span>
            {col.isDone && <CheckCircle2 size={13} style={{ color: '#22C55E', flexShrink: 0 }} />}
          </button>
        )}

        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--faint)', background: 'var(--wash)', borderRadius: 100, padding: '1px 8px', flexShrink: 0 }}>{tasks.length}</span>

        {canEdit && (
          <DropdownMenu
            trigger={<button aria-label="Spalten-Menü" style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}><MoreHorizontal size={16} /></button>}
            items={[
              { label: 'Umbenennen', icon: <Pencil size={14} />, onClick: () => setEditingName(true) },
              { label: col.isDone ? 'Nicht „Erledigt"' : 'Als „Erledigt"-Spalte', icon: col.isDone ? <Circle size={14} /> : <Check size={14} />, onClick: () => onPatch(col.id, { isDone: !col.isDone }) },
              ...(!isFirst ? [{ label: 'Nach links', icon: <ChevronLeft size={14} />, onClick: () => onMove(col.id, -1) }] : []),
              ...(!isLast ? [{ label: 'Nach rechts', icon: <ChevronRight size={14} />, onClick: () => onMove(col.id, 1) }] : []),
              { label: 'Spalte löschen', icon: <Trash2 size={14} />, danger: true, onClick: () => onRemove(col.id) },
            ]}
          />
        )}
      </div>

      {/* accent rule */}
      <div style={{ height: 3, borderRadius: 3, background: col.color, marginBottom: 10, flexShrink: 0 }} />

      {/* Cards */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', padding: '2px',
          borderRadius: 12, background: isOver ? 'rgba(var(--accent-rgb),.06)' : 'transparent', transition: `background .16s ${E}`,
        }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} memberName={memberName} canEdit={canEdit} onRemove={() => onRemoveCard(col.id, t.id)} onRename={(title) => onRenameCard(col.id, t.id, title)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && !adding && (
          <div style={{ fontSize: 12, color: 'var(--pale)', textAlign: 'center', padding: '14px 0' }}>Leer</div>
        )}
      </div>

      {/* Add card */}
      {canEdit && (
        <div style={{ flexShrink: 0, paddingTop: 8 }}>
          {adding ? (
            <textarea
              autoFocus value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitAdd(); } if (e.key === 'Escape') { setNewTitle(''); setAdding(false); } }}
              onBlur={commitAdd}
              placeholder="Aufgabe…"
              className="cos-input" style={{ padding: '9px 11px', fontSize: 13, minHeight: 56, resize: 'none' }}
            />
          ) : (
            <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '8px 10px', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: `background .14s ${E}, color .14s ${E}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--wash)'; e.currentTarget.style.color = 'var(--ink)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--faint)'; }}>
              <Plus size={15} /> Aufgabe
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Card ───────────────────────── */
function SortableCard({ task, memberName, canEdit, onRemove, onRename }: {
  task: BoardTask; memberName: (id: string | null) => string | null; canEdit: boolean; onRemove: () => void; onRename: (title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !canEdit });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };

  if (editing) {
    return (
      <div ref={setNodeRef} style={style}>
        <textarea autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } if (e.key === 'Escape') { setTitle(task.title); setEditing(false); } }}
          onBlur={() => { setEditing(false); if (title.trim() && title.trim() !== task.title) onRename(title); else setTitle(task.title); }}
          className="cos-input" style={{ padding: '9px 11px', fontSize: 13, minHeight: 54, resize: 'none' }} />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(canEdit ? listeners : {})} onClick={() => openTaskDrawer(task.id)}>
      <CardShell task={task} memberName={memberName}
        actions={canEdit ? (
          <div className="kb-card-actions" style={{ display: 'flex', gap: 2 }} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setEditing(true)} aria-label="Bearbeiten" style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--wash)'; e.currentTarget.style.color = 'var(--ink)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--faint)'; }}><Pencil size={12} /></button>
            <button onClick={onRemove} aria-label="Löschen" style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--faint)'; }}><Trash2 size={12} /></button>
          </div>
        ) : null}
      />
    </div>
  );
}

function CardShell({ task, memberName, actions, dragging }: { task: BoardTask; memberName: (id: string | null) => string | null; actions?: React.ReactNode; dragging?: boolean }) {
  const assignee = memberName(task.assigneeId);
  return (
    <div className="kb-card" style={{
      background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 12px',
      boxShadow: dragging ? '0 16px 40px rgba(0,0,0,.18)' : '0 1px 2px rgba(0,0,0,.04)',
      cursor: 'grab', display: 'flex', flexDirection: 'column', gap: 8,
      transform: dragging ? 'rotate(2deg)' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35, wordBreak: 'break-word' }}>{task.title}</span>
        {actions}
      </div>
      {(task.priority !== 'none' || !!task.dueDate || task.subtaskTotal > 0 || task.hasDescription || !!assignee) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flexWrap: 'wrap' }}>
            {task.priority !== 'none' && (
              <span title={PRIORITY_MAP[task.priority].label} style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_MAP[task.priority].color, flexShrink: 0 }} />
            )}
            {task.dueDate && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--faint)' }}><CalendarDays size={12} /> {formatDate(task.dueDate)}</span>
            )}
            {task.subtaskTotal > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: task.subtaskDone === task.subtaskTotal ? '#22C55E' : 'var(--faint)' }}><CheckSquare size={12} /> {task.subtaskDone}/{task.subtaskTotal}</span>
            )}
            {task.hasDescription && <AlignLeft size={12} style={{ color: 'var(--faint)' }} />}
          </div>
          {assignee && (
            <span title={assignee} style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {getInitials(assignee)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
