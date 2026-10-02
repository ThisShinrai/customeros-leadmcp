'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, MoreVertical, Pencil, Trash2, Share2, Users, PencilRuler, Check, Loader2, PanelLeft } from 'lucide-react';
import { Drawer, Button, Field, Input, DropdownMenu, ConfirmDialog, useToast } from '@/components/ui';
import { WhiteboardEditor, type WhiteboardScene, type SaveStatus } from '@/components/whiteboard/whiteboard-editor';
import type { WhiteboardListItem } from '@/lib/whiteboards/queries';
import {
  createWhiteboard, renameWhiteboard, setWhiteboardShared, deleteWhiteboard,
  saveWhiteboardScene, syncWhiteboard,
} from './actions';

const ease = 'cubic-bezier(.16,1,.3,1)';

interface Props {
  projectId: string;
  projectName: string;
  initialBoards: WhiteboardListItem[];
  canEdit: boolean;
}

export function WhiteboardWorkspace({ projectId, projectName, initialBoards, canEdit }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [boards, setBoards] = useState<WhiteboardListItem[]>(initialBoards);
  const [activeId, setActiveId] = useState<string | null>(initialBoards[0]?.id ?? null);
  const [scene, setScene] = useState<{ loading: boolean; data: WhiteboardScene | null; version: number }>({ loading: false, data: null, version: 0 });
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [remoteBy, setRemoteBy] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<WhiteboardListItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WhiteboardListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [wbRailOpen, setWbRailOpen] = useState(false);

  const active = boards.find((b) => b.id === activeId) ?? null;

  // Load the active board's scene (force scene fetch with sinceVersion = -1).
  useEffect(() => {
    if (!activeId) { setScene({ loading: false, data: null, version: 0 }); return; }
    let alive = true;
    setScene((s) => ({ ...s, loading: true }));
    setRemoteBy(null);
    setStatus('idle');
    syncWhiteboard(activeId, -1)
      .then((res) => {
        if (!alive) return;
        let parsed: WhiteboardScene | null = null;
        if (res.sceneJson) {
          try { parsed = JSON.parse(res.sceneJson) as WhiteboardScene; } catch { parsed = null; }
        }
        setScene({ loading: false, data: parsed, version: res.version });
      })
      .catch(() => { if (alive) setScene({ loading: false, data: null, version: 0 }); });
    return () => { alive = false; };
  }, [activeId]);

  const handleCreate = useCallback(async () => {
    setBusy(true);
    try {
      const { id } = await createWhiteboard(projectId, `Whiteboard ${boards.length + 1}`);
      const fresh: WhiteboardListItem = {
        id, name: `Whiteboard ${boards.length + 1}`, sharedWithClient: false, version: 0,
        updatedByName: null, updatedAt: new Date(), hasContent: false,
      };
      setBoards((prev) => [fresh, ...prev]);
      setActiveId(id);
      toast.success('Whiteboard erstellt.');
    } catch {
      toast.error('Konnte nicht erstellt werden.');
    } finally { setBusy(false); }
  }, [projectId, boards.length, toast]);

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return;
    setBusy(true);
    try {
      await renameWhiteboard(renameTarget.id, renameValue.trim());
      setBoards((prev) => prev.map((b) => (b.id === renameTarget.id ? { ...b, name: renameValue.trim() } : b)));
      setRenameTarget(null);
      toast.success('Umbenannt.');
    } catch {
      toast.error('Umbenennen fehlgeschlagen.');
    } finally { setBusy(false); }
  }

  async function handleToggleShare(b: WhiteboardListItem) {
    const next = !b.sharedWithClient;
    setBoards((prev) => prev.map((x) => (x.id === b.id ? { ...x, sharedWithClient: next } : x)));
    try {
      await setWhiteboardShared(b.id, next);
      toast.success(next ? 'Für Kunden freigegeben.' : 'Freigabe entfernt.');
    } catch {
      setBoards((prev) => prev.map((x) => (x.id === b.id ? { ...x, sharedWithClient: !next } : x)));
      toast.error('Freigabe fehlgeschlagen.');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteWhiteboard(deleteTarget.id);
      const remaining = boards.filter((b) => b.id !== deleteTarget.id);
      setBoards(remaining);
      if (activeId === deleteTarget.id) setActiveId(remaining[0]?.id ?? null);
      setDeleteTarget(null);
      toast.success('Whiteboard gelöscht.');
    } catch {
      toast.error('Löschen fehlgeschlagen.');
    } finally { setBusy(false); }
  }

  return (
    <div data-fullbleed style={{ display: 'flex', height: 'calc(100vh - 16px)', overflow: 'hidden' }}>
      {/* Mobile backdrop for the board-rail drawer */}
      <div className="wb-rail-backdrop" data-open={wbRailOpen} onClick={() => setWbRailOpen(false)} aria-hidden />
      {/* Board rail — off-canvas drawer on mobile */}
      <aside className="wb-rail wb-rail-drawer" data-open={wbRailOpen} style={{ width: 248, flexShrink: 0, borderRight: '1px solid #EDECE9', display: 'flex', flexDirection: 'column', background: '#FBFAF8' }}>
        <div style={{ padding: '16px 16px 12px' }}>
          <Link href={`/app/a/projects/${projectId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#909090', marginBottom: 14 }}>
            <ArrowLeft size={14} /> {projectName}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, letterSpacing: '-.4px', color: '#0A0A0A' }}>
              <PencilRuler size={16} style={{ color: 'var(--accent)' }} /> Whiteboards
            </span>
          </div>
        </div>

        {canEdit && (
          <div style={{ padding: '0 12px 10px' }}>
            <Button size="sm" icon={<Plus size={14} strokeWidth={2.5} />} onClick={() => { void handleCreate(); setWbRailOpen(false); }} loading={busy} style={{ width: '100%', justifyContent: 'center' }}>
              Neues Whiteboard
            </Button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {boards.length === 0 && (
            <div style={{ padding: '28px 14px', textAlign: 'center', color: '#B0AFAB', fontSize: 12.5, lineHeight: 1.5 }}>
              Noch keine Whiteboards.{canEdit ? ' Erstelle das erste oben.' : ''}
            </div>
          )}
          {boards.map((b) => {
            const isActive = b.id === activeId;
            return (
              <div
                key={b.id}
                onClick={() => { setActiveId(b.id); setWbRailOpen(false); }}
                className="wb-board-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 11, cursor: 'pointer',
                  background: isActive ? '#0A0A0A' : 'transparent',
                  color: isActive ? '#fff' : '#1C1B18',
                  transition: `background .16s ${ease}`,
                }}
              >
                <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: isActive ? 'rgba(var(--accent-rgb),.25)' : '#EFEEEA', color: isActive ? 'var(--accent)' : '#909090' }}>
                  <PencilRuler size={14} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                  <div style={{ fontSize: 10.5, color: isActive ? 'rgba(255,255,255,.55)' : '#B0AFAB', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {b.sharedWithClient ? <><Share2 size={9} /> freigegeben</> : 'privat'}
                  </div>
                </div>
                {canEdit && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      trigger={
                        <button style={{ width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', color: isActive ? 'rgba(255,255,255,.7)' : '#B0AFAB', background: 'transparent' }} aria-label="Optionen">
                          <MoreVertical size={14} />
                        </button>
                      }
                      items={[
                        { label: 'Umbenennen', icon: <Pencil size={14} />, onClick: () => { setRenameTarget(b); setRenameValue(b.name); } },
                        { label: b.sharedWithClient ? 'Freigabe entfernen' : 'Für Kunden freigeben', icon: <Share2 size={14} />, onClick: () => handleToggleShare(b) },
                        { label: 'Löschen', icon: <Trash2 size={14} />, danger: true, onClick: () => setDeleteTarget(b) },
                      ]}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        {/* Header strip */}
        <header style={{ height: 52, flexShrink: 0, borderBottom: '1px solid #EDECE9', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', background: '#fff', zIndex: 5 }}>
          <button
            className="cos-mobile-only"
            onClick={() => setWbRailOpen(true)}
            aria-label="Whiteboards öffnen"
            style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, alignItems: 'center', justifyContent: 'center', border: '1.5px solid #E4E3DF', background: '#fff', color: '#0A0A0A' }}
          >
            <PanelLeft size={17} />
          </button>
          {active ? (
            <>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-.2px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.name}</span>
              <SaveBadge status={status} />
              {remoteBy && (
                <span className="cos-desktop-only" style={{ fontSize: 11, color: '#909090', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Users size={11} /> aktualisiert von {remoteBy}
                </span>
              )}
              <span style={{ flex: 1 }} />
              {canEdit && (
                <button
                  onClick={() => handleToggleShare(active)}
                  title={active.sharedWithClient ? 'Freigegeben für Kunden' : 'Für Kunden freigeben'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, flexShrink: 0,
                    border: active.sharedWithClient ? '1.5px solid transparent' : '1.5px solid #E4E3DF',
                    background: active.sharedWithClient ? 'var(--accent)' : '#fff',
                    color: active.sharedWithClient ? '#fff' : '#505050',
                    transition: `all .16s ${ease}`,
                  }}
                >
                  <Share2 size={13} /> <span className="cos-desktop-only">{active.sharedWithClient ? 'Freigegeben für Kunden' : 'Für Kunden freigeben'}</span>
                </button>
              )}
            </>
          ) : (
            <span style={{ fontSize: 13, color: '#909090' }}>Kein Whiteboard ausgewählt</span>
          )}
        </header>

        {/* Editor area */}
        <div style={{ flex: 1, position: 'relative', background: '#fff' }}>
          {!active ? (
            <EmptyCanvas canEdit={canEdit} onCreate={handleCreate} />
          ) : scene.loading ? (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#909090', fontSize: 14, gap: 8 }}>
              <Loader2 size={20} className="wb-spin" /> Lädt …
            </div>
          ) : (
            <WhiteboardEditor
              key={active.id}
              boardId={active.id}
              initialScene={scene.data}
              initialVersion={scene.version}
              canEdit={canEdit}
              saveAction={saveWhiteboardScene}
              syncAction={syncWhiteboard}
              onStatusChange={setStatus}
              onRemoteUpdate={setRemoteBy}
            />
          )}
        </div>
      </div>

      {/* Rename drawer */}
      <Drawer
        open={!!renameTarget}
        onClose={() => { if (!busy) setRenameTarget(null); }}
        title="Whiteboard umbenennen"
        width={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameTarget(null)} disabled={busy}>Abbrechen</Button>
            <Button onClick={handleRename} loading={busy}>Speichern</Button>
          </>
        }
      >
        <Field label="Name">
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }} />
        </Field>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={busy}
        danger
        title="Whiteboard löschen?"
        message="Das Whiteboard und alle Zeichnungen werden unwiderruflich gelöscht."
        confirmLabel="Endgültig löschen"
      />

      <style>{`
        .wb-board-row:hover { background: ${'#F0EFEB'}; }
        .wb-board-row[style*="rgb(10, 10, 10)"]:hover { background: #0A0A0A; }
        .wb-spin { animation: spin 1s linear infinite; }
        .wb-rail-backdrop { display: none; }
        /* On mobile the board rail becomes an off-canvas drawer (opened via the
           PanelLeft button) so the canvas gets the full width. */
        @media (max-width: 860px) {
          .wb-rail-drawer {
            position: fixed; left: 0; top: 0; bottom: 0; z-index: 60;
            width: min(284px, 86vw) !important;
            transform: translateX(-101%);
            transition: transform .3s ${ease};
            box-shadow: 0 18px 60px rgba(0,0,0,.42);
            border-radius: 0 18px 18px 0;
          }
          .wb-rail-drawer[data-open="true"] { transform: translateX(0); }
          .wb-rail-backdrop {
            display: none; position: fixed; inset: 0; z-index: 59;
            background: rgba(10,10,10,.45); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
            animation: overlayIn .2s ${ease} both;
          }
          .wb-rail-backdrop[data-open="true"] { display: block; }
        }
      `}</style>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return <span style={{ fontSize: 11, color: '#909090', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Loader2 size={11} className="wb-spin" /> Speichert …</span>;
  }
  if (status === 'saved') {
    return <span style={{ fontSize: 11, color: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Check size={11} /> Gespeichert</span>;
  }
  return null;
}

function EmptyCanvas({ canEdit, onCreate }: { canEdit: boolean; onCreate: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(var(--accent-rgb),.1)', color: 'var(--accent)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
          <PencilRuler size={28} />
        </div>
        <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.5px', color: '#0A0A0A', marginBottom: 8 }}>Visuell zusammenarbeiten</h3>
        <p style={{ fontSize: 13.5, color: '#909090', lineHeight: 1.6, marginBottom: 20 }}>
          Skizzen, Wireframes, Moodboards — zeichne frei und gib das Board für deinen Kunden frei, um live gemeinsam daran zu arbeiten.
        </p>
        {canEdit && <Button icon={<Plus size={15} strokeWidth={2.5} />} onClick={onCreate}>Erstes Whiteboard erstellen</Button>}
      </div>
    </div>
  );
}
