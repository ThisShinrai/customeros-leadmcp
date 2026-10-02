'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  X, Trash2, Plus, CalendarDays, Loader2, ExternalLink, AlignLeft, Flag, Folder, UserCircle2, Columns3,
} from 'lucide-react';
import { Drawer, Button, useToast } from '@/components/ui';
import { getInitials, formatDate } from '@/lib/utils';
import { getTaskDetail, createSubtask, toggleSubtask, setTaskColumn, type TaskDetailData } from './actions';
import { updateTask, deleteTask } from '../projects/actions';
import { PRIORITY_MAP, PRIORITIES, type Priority } from './shared';

const E = 'cubic-bezier(.16,1,.3,1)';

interface Sub { id: string; title: string; done: boolean }

/**
 * Asana-style task detail drawer. Opens via the global `cos:open-task` event
 * ({ detail: { taskId } }), loads getTaskDetail, and edits every field inline
 * (title, description, column, priority, assignee, due, subtasks, delete).
 * Mounted once in the agency layout.
 */
export function TaskDetailDrawer() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  // editable locals
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('none');
  const [columnId, setColumnId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [due, setDue] = useState('');
  const [subs, setSubs] = useState<Sub[]>([]);
  const [newSub, setNewSub] = useState('');
  const [deleting, setDeleting] = useState(false);
  const dirty = useRef(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setDetail(null);
    try {
      const d = await getTaskDetail(id);
      if (!d) { toast.error('Aufgabe nicht gefunden.'); setOpen(false); return; }
      setDetail(d);
      setTitle(d.title);
      setDescription(d.description ?? '');
      setPriority(d.priority);
      setColumnId(d.columnId);
      setAssigneeId(d.assigneeId);
      setDue(d.dueDate ? new Date(d.dueDate).toISOString().slice(0, 10) : '');
      setSubs(d.subtasks);
    } catch { toast.error('Konnte Aufgabe nicht laden.'); setOpen(false); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ taskId: string }>).detail?.taskId;
      if (!id) return;
      dirty.current = false;
      setTaskId(id);
      setOpen(true);
      void load(id);
    };
    window.addEventListener('cos:open-task', onOpen as EventListener);
    return () => window.removeEventListener('cos:open-task', onOpen as EventListener);
  }, [load]);

  const close = useCallback(() => {
    setOpen(false);
    if (dirty.current) { dirty.current = false; router.refresh(); }
  }, [router]);

  function patch(fn: () => Promise<unknown>) {
    dirty.current = true;
    fn().catch(() => { toast.error('Speichern fehlgeschlagen.'); router.refresh(); });
  }

  // field savers
  const saveTitle = () => { const t = title.trim(); if (taskId && t && t !== detail?.title) patch(() => updateTask({ id: taskId, title: t })); else if (!t) setTitle(detail?.title ?? ''); };
  const saveDesc = () => { if (taskId && description !== (detail?.description ?? '')) patch(() => updateTask({ id: taskId, description: description.trim() || null })); };
  const pickPriority = (p: Priority) => { if (!taskId) return; setPriority(p); patch(() => updateTask({ id: taskId, priority: p })); };
  const pickColumn = (cid: string) => { if (!taskId) return; setColumnId(cid); patch(() => setTaskColumn(taskId, cid)); };
  const pickAssignee = (aid: string | null) => { if (!taskId) return; setAssigneeId(aid); patch(() => updateTask({ id: taskId, assigneeId: aid })); };
  const pickDue = (v: string) => { if (!taskId) return; setDue(v); patch(() => updateTask({ id: taskId, dueDate: v || null })); };

  async function addSub() {
    const t = newSub.trim();
    if (!t || !taskId) return;
    setNewSub('');
    dirty.current = true;
    try { const s = await createSubtask(taskId, t); setSubs((x) => [...x, s]); }
    catch { toast.error('Subtask konnte nicht erstellt werden.'); }
  }
  function flipSub(s: Sub) {
    const done = !s.done;
    setSubs((x) => x.map((y) => (y.id === s.id ? { ...y, done } : y)));
    dirty.current = true;
    toggleSubtask(s.id, done).catch(() => { toast.error('Subtask-Status fehlgeschlagen.'); router.refresh(); });
  }
  function removeSub(id: string) {
    setSubs((x) => x.filter((y) => y.id !== id));
    dirty.current = true;
    deleteTask(id).catch(() => { toast.error('Subtask konnte nicht gelöscht werden.'); router.refresh(); });
  }

  async function handleDelete() {
    if (!taskId) return;
    setDeleting(true);
    try { await deleteTask(taskId); toast.success('Aufgabe gelöscht.'); dirty.current = true; close(); }
    catch { toast.error('Konnte nicht gelöscht werden.'); setDeleting(false); }
  }

  const subDone = subs.filter((s) => s.done).length;

  return (
    <Drawer
      open={open}
      onClose={close}
      side="right"
      width={560}
      footer={detail ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <button onClick={handleDelete} disabled={deleting} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: '#DC2626', fontSize: 13, fontWeight: 600 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            {deleting ? <Loader2 size={15} className="cos-spin" /> : <Trash2 size={15} />} Löschen
          </button>
          <Button onClick={close}>Fertig</Button>
        </div>
      ) : undefined}
    >
      {loading || !detail ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: 'var(--faint)' }}>
          <Loader2 size={26} className="cos-spin" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Header: project + close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Link href={`/app/a/projects/${detail.projectId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--mid)', background: 'var(--wash)', borderRadius: 100, padding: '5px 11px' }}>
              <Folder size={12} /> {detail.projectName} <ExternalLink size={11} style={{ opacity: .6 }} />
            </Link>
            <button onClick={close} aria-label="Schließen" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--wash)', color: 'var(--mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
          </div>

          {/* Title */}
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
            rows={1}
            placeholder="Titel"
            style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.6px', color: 'var(--black)', border: 'none', outline: 'none', resize: 'none', width: '100%', fontFamily: 'inherit', lineHeight: 1.25, background: 'transparent', overflow: 'hidden' }}
          />

          {/* Meta fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <MetaRow icon={<Columns3 size={15} />} label="Spalte">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {detail.columns.map((c) => {
                  const sel = columnId === c.id;
                  return (
                    <button key={c.id} onClick={() => pickColumn(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 100, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: sel ? `1.5px solid ${c.color}` : '1.5px solid var(--line)', background: sel ? `${c.color}1A` : '#fff', color: sel ? 'var(--black)' : 'var(--mid)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} /> {c.name}
                    </button>
                  );
                })}
              </div>
            </MetaRow>

            <MetaRow icon={<Flag size={15} />} label="Priorität">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PRIORITIES.map((p) => {
                  const cfg = PRIORITY_MAP[p];
                  const sel = priority === p;
                  return (
                    <button key={p} onClick={() => pickPriority(p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 100, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: sel ? `1.5px solid ${cfg.color}` : '1.5px solid var(--line)', background: sel ? `${cfg.color}1A` : '#fff', color: sel ? 'var(--black)' : 'var(--mid)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} /> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </MetaRow>

            <MetaRow icon={<UserCircle2 size={15} />} label="Zuständig">
              <select value={assigneeId ?? ''} onChange={(e) => pickAssignee(e.target.value || null)} className="cos-input" style={{ padding: '8px 11px', fontSize: 13, maxWidth: 240 }}>
                <option value="">Niemand</option>
                {detail.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </MetaRow>

            <MetaRow icon={<CalendarDays size={15} />} label="Fällig">
              <input type="date" value={due} onChange={(e) => pickDue(e.target.value)} className="cos-input" style={{ padding: '8px 11px', fontSize: 13, maxWidth: 180 }} />
            </MetaRow>
          </div>

          {/* Description */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
              <AlignLeft size={14} /> Beschreibung
            </div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={saveDesc} placeholder="Details, Kontext, Links …" className="cos-input" style={{ minHeight: 90, fontSize: 13.5, lineHeight: 1.5 }} />
          </div>

          {/* Subtasks */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>Unteraufgaben</span>
              {subs.length > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--faint)' }}>{subDone}/{subs.length}</span>}
            </div>
            {subs.length > 0 && (
              <div style={{ height: 5, background: 'var(--wash)', borderRadius: 100, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${Math.round((subDone / subs.length) * 100)}%`, background: 'var(--accent)', borderRadius: 100, transition: `width .4s ${E}` }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {subs.map((s) => (
                <div key={s.id} className="cos-sub-row" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 6px', borderRadius: 8 }}>
                  <button onClick={() => flipSub(s)} style={{ width: 19, height: 19, borderRadius: 6, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: s.done ? 'none' : '1.5px solid var(--pale)', background: s.done ? 'var(--accent)' : 'transparent', color: '#fff' }}>
                    {s.done && <CheckMark />}
                  </button>
                  <span style={{ flex: 1, fontSize: 13, color: s.done ? 'var(--faint)' : 'var(--ink)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</span>
                  <button className="cos-sub-del" onClick={() => removeSub(s.id)} aria-label="Löschen" style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pale)', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--pale)'; }}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, padding: '0 6px' }}>
              <Plus size={15} style={{ color: 'var(--faint)', flexShrink: 0 }} />
              <input value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addSub(); }} onBlur={addSub} placeholder="Unteraufgabe hinzufügen…" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', fontFamily: 'inherit', color: 'var(--ink)' }} />
            </div>
          </div>

          <style>{`
            .cos-sub-row .cos-sub-del { opacity: 0; transition: opacity .14s ${E}; }
            .cos-sub-row:hover { background: var(--wash); }
            .cos-sub-row:hover .cos-sub-del { opacity: 1; }
          `}</style>
        </div>
      )}
    </Drawer>
  );
}

function MetaRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, width: 110, flexShrink: 0, color: 'var(--faint)', fontSize: 12.5, fontWeight: 600, paddingTop: 5 }}>
        {icon} {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function CheckMark() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
