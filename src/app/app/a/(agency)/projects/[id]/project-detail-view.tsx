'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Circle, Plus, Trash2, MoreVertical, Archive, Pencil, PencilRuler, LayoutGrid, List, Link2, ExternalLink } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Chip, Button, DropdownMenu, ConfirmDialog, useToast, BentoCard } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { embedInfo } from '@/lib/embed';
import { createTask, setTaskStatus, deleteTask, setProjectStatus, deleteProject } from '../actions';
import { createResource, deleteResource } from './resource-actions';
import { ProjectFiles } from './project-files';
import { ProjectChat } from './project-chat';
import { ProjectTeam } from './project-team';
import { ProjectClients } from './project-clients';
import { TaskBoard, type BoardTask, type BoardCol } from './task-board';
import type { ProjectDetail } from '../queries';
import type { ProjectResource } from '@/lib/db';

export interface FilePerms { upload: boolean; release: boolean; delete: boolean }
export interface FolderItem { id: string; name: string; parentId: string | null; visibleToClient: boolean }
interface AssignableMember { id: string; name: string; role: string }

const STATUS_LABEL: Record<string, string> = { open: 'Offen', active: 'In Bearbeitung', feedback: 'Feedback', done: 'Abgeschlossen', archived: 'Archiviert' };
const STATUS_CHIP: Record<string, 'filled' | 'outline' | 'gray' | 'green'> = { open: 'gray', active: 'filled', feedback: 'outline', done: 'green', archived: 'gray' };

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <BentoCard padding="18px 20px" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: '#909090' }}>{title}</div>
        {action}
      </div>
      {children}
    </BentoCard>
  );
}

function ProjectResources({ projectId, resources, canEdit }: { projectId: string; resources: ProjectResource[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  async function add() {
    const t = title.trim();
    const u = url.trim();
    if (!t || !u) return;
    setAdding(true);
    try {
      await createResource({ projectId, title: t, url: u });
      setTitle(''); setUrl('');
      toast.success('Ressource hinzugefügt.');
      router.refresh();
    } catch { toast.error('Ressource konnte nicht hinzugefügt werden. URL prüfen.'); }
    setAdding(false);
  }

  function remove(id: string) {
    startTransition(async () => {
      try { await deleteResource(id); router.refresh(); }
      catch { toast.error('Ressource konnte nicht gelöscht werden.'); }
    });
  }

  return (
    <Card title="Ressourcen">
      {resources.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#b0b0b0', padding: '4px 0 2px' }}>
          <Link2 size={15} /> Noch keine Ressourcen.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {resources.map((r) => {
            const { provider } = embedInfo(r.url);
            return (
              <div key={r.id} className="res-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: '#F9F9F8', border: '1px solid #F0EFEC' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Link2 size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1B18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: '#909090' }}>{provider}</div>
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer" title="Öffnen" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 11px', borderRadius: 8, border: '1px solid #E4E3DF', background: '#fff', color: '#1C1B18', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                  <ExternalLink size={13} /> Öffnen
                </a>
                {canEdit && (
                  <button className="res-del" onClick={() => remove(r.id)} title="Löschen" style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C4C4C0', flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C4C4C0'; }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {canEdit && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: resources.length ? 14 : 12 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="Titel" className="cos-input" style={{ flex: '1 1 130px', minWidth: 0, padding: '9px 12px', fontSize: 13.5 }} />
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="https://…" className="cos-input" style={{ flex: '2 1 200px', minWidth: 0, padding: '9px 12px', fontSize: 13.5 }} />
          <Button size="sm" icon={<Plus size={14} />} onClick={add} loading={adding}>Hinzufügen</Button>
        </div>
      )}
    </Card>
  );
}

function ViewToggle({ mode, onChange }: { mode: 'board' | 'list'; onChange: (m: 'board' | 'list') => void }) {
  const E = 'cubic-bezier(.16,1,.3,1)';
  return (
    <div style={{ display: 'inline-flex', background: 'var(--wash)', borderRadius: 9, padding: 3, gap: 2 }}>
      {([['board', 'Board', LayoutGrid], ['list', 'Liste', List]] as const).map(([m, label, Icon]) => {
        const active = mode === m;
        return (
          <button key={m} onClick={() => onChange(m)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 7, border: 'none', cursor: 'pointer',
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

interface LocalTask { id: string; title: string; status: 'open' | 'active' | 'done'; dueDate: number | null }

export function ProjectDetailView({ detail, canEdit, filePerms, assignableMembers, assignableClients, resources, folders }: { detail: ProjectDetail; canEdit: boolean; filePerms: FilePerms; assignableMembers: AssignableMember[]; assignableClients: { id: string; name: string; company: string | null }[]; resources: ProjectResource[]; folders: FolderItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const { project } = detail;

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  const [tasks, setTasks] = useState<LocalTask[]>(
    detail.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.dueDate ? new Date(t.dueDate).getTime() : null })),
  );
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Board data (from SSR detail).
  const boardColumns: BoardCol[] = detail.columns.map((c) => ({ id: c.id, name: c.name, color: c.color, isDone: c.isDone }));
  const boardTasks: BoardTask[] = detail.tasks.map((t) => ({
    id: t.id, title: t.title, columnId: t.columnId,
    dueDate: t.dueDate ? new Date(t.dueDate).getTime() : null,
    assigneeId: t.assigneeId,
    priority: t.priority,
    subtaskDone: detail.subtaskCounts[t.id]?.done ?? 0,
    subtaskTotal: detail.subtaskCounts[t.id]?.total ?? 0,
    hasDescription: !!(t.description && t.description.trim()),
  }));

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const percent = project.status === 'done' ? 100 : tasks.length ? Math.round((doneCount / tasks.length) * 100) : detail.percent;

  function toggleTask(t: LocalTask) {
    if (!canEdit) return;
    const next = t.status === 'done' ? 'open' : 'done';
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    startTransition(async () => {
      try { await setTaskStatus(t.id, next); } catch { toast.error('Konnte Aufgabe nicht aktualisieren.'); router.refresh(); }
    });
  }

  async function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      const created = await createTask({ projectId: project.id, title, dueDate: newDue || undefined });
      setTasks((ts) => [...ts, { id: created.id, title: created.title, status: created.status, dueDate: created.dueDate }]);
      setNewTitle(''); setNewDue('');
      toast.success('Aufgabe hinzugefügt.');
    } catch { toast.error('Aufgabe konnte nicht erstellt werden.'); }
    setAdding(false);
  }

  function removeTask(id: string) {
    setTasks((ts) => ts.filter((x) => x.id !== id));
    startTransition(async () => {
      try { await deleteTask(id); } catch { toast.error('Konnte Aufgabe nicht löschen.'); router.refresh(); }
    });
  }

  async function changeStatus(status: 'open' | 'active' | 'feedback' | 'done' | 'archived') {
    try {
      await setProjectStatus(project.id, status);
      toast.success(status === 'archived' ? 'Projekt archiviert.' : 'Status aktualisiert.');
      if (status === 'archived') router.push('/app/a/projects');
      else router.refresh();
    } catch { toast.error('Status konnte nicht geändert werden.'); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteProject(project.id);
      toast.success('Projekt gelöscht.');
      router.push('/app/a/projects');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast.error(msg.includes('HAS_INVOICES')
        ? 'Projekt hat Rechnungen und kann nicht gelöscht werden — Rechnungen zuerst löschen.'
        : 'Projekt konnte nicht gelöscht werden.');
      setDeleting(false);
    }
  }

  return (
    <>
      <Topbar title={project.name} subtitle={detail.clients.map((c) => c.name).join(', ') || 'Kein Kunde zugeordnet'} />

      <div style={{ padding: '24px 28px 56px' }}>
        <Link href="/app/a/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#505050', marginBottom: 20 }}>
          <ArrowLeft size={14} /> Zurück zur Übersicht
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1.2px', color: '#0A0A0A', margin: 0 }}>{project.name}</h1>
              <Chip variant={STATUS_CHIP[project.status]}>{STATUS_LABEL[project.status]}</Chip>
            </div>
            <div style={{ fontSize: 13, color: '#909090' }}>
              {project.startDate ? `Gestartet ${formatDate(project.startDate)}` : 'Kein Startdatum'}
              {project.endDate ? ` · geplant bis ${formatDate(project.endDate)}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link
              href={`/app/a/projects/${project.id}/whiteboard`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px', borderRadius: 100,
                border: '1.5px solid #E4E3DF', background: '#fff', color: '#1C1B18', fontSize: 13, fontWeight: 600,
                transition: 'all .16s cubic-bezier(.16,1,.3,1)',
              }}
            >
              <PencilRuler size={15} style={{ color: 'var(--accent)' }} /> Whiteboard
            </Link>
            {canEdit && (
              <DropdownMenu
                trigger={<button style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #E4E3DF', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#505050', cursor: 'pointer' }}><MoreVertical size={16} /></button>}
                items={[
                  { label: 'Als „In Bearbeitung"', icon: <Circle size={14} />, onClick: () => changeStatus('active') },
                  { label: 'Auf „Feedback" setzen', icon: <Pencil size={14} />, onClick: () => changeStatus('feedback') },
                  { label: 'Als abgeschlossen', icon: <Check size={14} />, onClick: () => changeStatus('done') },
                  { label: 'Archivieren', icon: <Archive size={14} />, onClick: () => changeStatus('archived') },
                  { label: 'Projekt löschen', icon: <Trash2 size={14} />, danger: true, onClick: () => setConfirmDelete(true) },
                ]}
              />
            )}
          </div>
        </div>

        {/* Progress — full width */}
        <Card title="Fortschritt">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 14 }}>
            <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-3px', lineHeight: .9, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{percent}%</span>
            <span style={{ fontSize: 13, color: '#909090', marginBottom: 6 }}>{doneCount} von {tasks.length} Aufgaben erledigt</span>
          </div>
          <div style={{ height: 8, background: '#EDECE9', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${percent}%`, background: 'var(--accent)', borderRadius: 100, transition: 'width .8s cubic-bezier(.16,1,.3,1)' }} />
          </div>
        </Card>

        {/* Tasks — full width, Board ↔ List */}
        <Card title="Aufgaben" action={<ViewToggle mode={viewMode} onChange={setViewMode} />}>
          {viewMode === 'board' ? (
            <TaskBoard projectId={project.id} initialColumns={boardColumns} initialTasks={boardTasks} members={assignableMembers} canEdit={canEdit} />
          ) : (
            <>
              <div>
                {tasks.length === 0 && <div style={{ fontSize: 13, color: '#b0b0b0', padding: '6px 0 12px' }}>Noch keine Aufgaben. Fügen Sie die erste hinzu.</div>}
                {tasks.map((t) => {
                  const done = t.status === 'done';
                  return (
                    <div key={t.id} className="task-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #F4F3F0' }}>
                      <button onClick={() => toggleTask(t)} disabled={!canEdit} style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: done ? 'var(--accent)' : 'transparent', color: done ? '#fff' : '#C4C4C0', border: done ? 'none' : '1.5px solid #E4E3DF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canEdit ? 'pointer' : 'default' }}>
                        {done ? <Check size={12} /> : <Circle size={10} />}
                      </button>
                      <span style={{ flex: 1, fontSize: 13.5, color: done ? '#b0b0b0' : '#1C1B18', textDecoration: done ? 'line-through' : 'none' }}>{t.title}</span>
                      {t.dueDate && <span style={{ fontSize: 11, color: '#909090', whiteSpace: 'nowrap' }}>{formatDate(t.dueDate)}</span>}
                      {canEdit && <button className="task-del" onClick={() => removeTask(t.id)} style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C4C4C0', flexShrink: 0 }} onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C4C4C0'; }}><Trash2 size={13} /></button>}
                    </div>
                  );
                })}
              </div>
              {canEdit && (
                <div className="task-add-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }} placeholder="Neue Aufgabe…" className="cos-input task-add-title" style={{ flex: '2 1 180px', minWidth: 0, padding: '9px 12px', fontSize: 13.5 }} />
                  <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="cos-input task-add-date" style={{ flex: '0 1 150px', minWidth: 0, padding: '9px 12px', fontSize: 13 }} />
                  <Button size="sm" icon={<Plus size={14} />} onClick={addTask} loading={adding}>Hinzufügen</Button>
                </div>
              )}
            </>
          )}
        </Card>

        <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, alignItems: 'start' }}>
          <div className="detail-left">
            <ProjectFiles projectId={project.id} channelId={detail.channelId} files={detail.files} folders={folders} canUpload={filePerms.upload} canRelease={filePerms.release} canDelete={filePerms.delete} />
            <ProjectResources projectId={project.id} resources={resources} canEdit={canEdit} />
            <ProjectChat channelId={detail.channelId} />
          </div>

          <div className="detail-right">
            <Card title="Projektdetails">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[
                  { label: 'Status', value: STATUS_LABEL[project.status] },
                  { label: 'Gestartet', value: project.startDate ? formatDate(project.startDate) : '—' },
                  { label: 'Fertig geplant', value: project.endDate ? formatDate(project.endDate) : '—' },
                  { label: 'Fortschritt', value: `${percent}%` },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#909090' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1B18' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <ProjectClients
              projectId={project.id}
              clients={detail.clients}
              assignable={assignableClients}
              canEdit={canEdit}
            />

            <ProjectTeam
              projectId={project.id}
              members={detail.members}
              assignable={assignableMembers}
              chatBypass={project.chatBypass}
              canEdit={canEdit}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={handleDelete} loading={deleting} danger title="Projekt löschen?" message="Dieses Projekt und alle zugehörigen Aufgaben, Dateien und Nachrichten werden unwiderruflich gelöscht." confirmLabel="Endgültig löschen" />

      <style>{`
        .task-del { opacity: 0; transition: opacity .14s; }
        .task-row:hover .task-del { opacity: 1; }
        .res-del { opacity: 0; transition: opacity .14s; }
        .res-row:hover .res-del { opacity: 1; }
        @media (min-width: 900px) {
          .detail-grid { grid-template-columns: 1fr 360px !important; }
        }
      `}</style>
    </>
  );
}
