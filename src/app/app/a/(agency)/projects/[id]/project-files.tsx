'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Download, Trash2, Eye, EyeOff, Folder, FolderPlus, ChevronRight, MoreVertical, FolderInput, Pencil, FolderOpen, MessageSquare } from 'lucide-react';
import { useToast, Spinner, Modal, Button, Field, Input, Select, ConfirmDialog, DropdownMenu, Chip, TimeAgo, type DropdownItem } from '@/components/ui';
import { formatBytes, fileTypeLabel } from '@/lib/utils';
import { FilePreviewModal, type PreviewFile } from '@/components/files/file-preview';
import { useChat } from '@/components/chat';
import { sendMessage as sendChatMessage } from '@/components/chat/actions';
import { uploadProjectFile, setFileVisibility, deleteProjectFile, renameProjectFile } from './file-actions';
import { createFolder, renameFolder, deleteFolder, setFolderVisible, moveFileToFolder } from './folder-actions';
import type { ProjectFileItem } from '../queries';
import type { FolderItem } from './project-detail-view';

interface Props {
  projectId: string;
  channelId: string | null;
  files: ProjectFileItem[];
  folders: FolderItem[];
  canUpload: boolean;
  canRelease: boolean;
  canDelete: boolean;
}

/** Build the chain of folders from root to the given id (for the breadcrumb). */
function folderPath(folders: FolderItem[], id: string | null): FolderItem[] {
  if (!id) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: FolderItem[] = [];
  let cur = byId.get(id);
  let guard = 0;
  while (cur && guard++ < 50) {
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

export function ProjectFiles({ projectId, channelId, files, folders, canUpload, canRelease, canDelete }: Props) {
  const router = useRouter();
  const toast = useToast();
  const chat = useChat();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<PreviewFile | null>(null);
  // Anzeigename beim Einzel-Upload + Umbenennen bestehender Dateien.
  const [nameTarget, setNameTarget] = useState<File | null>(null);
  const [nameValue, setNameValue] = useState('');
  const [renameFile, setRenameFile] = useState<ProjectFileItem | null>(null);
  const [renameFileValue, setRenameFileValue] = useState('');

  /** Datei als Chip im Projekt-Chat referenzieren und den Chat öffnen. */
  async function shareToChat(f: PreviewFile) {
    if (!channelId) return;
    try {
      await sendChatMessage(channelId, `[datei:${f.id}|${f.name}]`);
      chat.openProjectChannel(channelId);
      setPreview(null);
      toast.success('Datei im Projekt-Chat geteilt.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast.error(msg.includes('FORBIDDEN')
        ? 'Du bist kein Teilnehmer des Projekt-Chats — erst im Team-Panel zuweisen.'
        : 'Teilen fehlgeschlagen.');
    }
  }

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Modals.
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [savingFolder, setSavingFolder] = useState(false);

  const [renameTarget, setRenameTarget] = useState<FolderItem | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<FolderItem | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);

  const [moveTarget, setMoveTarget] = useState<ProjectFileItem | null>(null);
  const [moveDest, setMoveDest] = useState<string>('');
  const [moving, setMoving] = useState(false);

  // Current level.
  const path = useMemo(() => folderPath(folders, currentFolderId), [folders, currentFolderId]);
  const subfolders = useMemo(
    () => folders.filter((f) => f.parentId === currentFolderId).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [folders, currentFolderId],
  );
  const visibleFiles = useMemo(
    () => files.filter((f) => (f.folderId ?? null) === currentFolderId),
    [files, currentFolderId],
  );

  // Flat folder options for the move-Select, each labelled with its full path.
  const folderOptions = useMemo(
    () => folders
      .map((f) => ({ id: f.id, label: folderPath(folders, f.id).map((p) => p.name).join(' / ') }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de')),
    [folders],
  );

  async function doUpload(fileArr: File[], displayName?: string) {
    setUploading(true);
    try {
      for (const file of fileArr) {
        const fd = new FormData();
        fd.set('projectId', projectId);
        fd.set('file', file);
        fd.append('folderId', currentFolderId ?? '');
        if (displayName) fd.set('displayName', displayName);
        await uploadProjectFile(fd);
      }
      toast.success(fileArr.length === 1 ? 'Datei hochgeladen.' : `${fileArr.length} Dateien hochgeladen.`);
      router.refresh();
    } catch (e) {
      const msg = String((e as Error).message);
      toast.error(msg.includes('TOO_LARGE') ? 'Datei zu groß (max. 50 MB).' : 'Upload fehlgeschlagen.');
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function upload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const arr = Array.from(fileList);
    // Einzelne Datei: erst nach einem Anzeigenamen fragen (vorbelegt mit dem
    // Dateinamen — gerade Clipboard-Uploads heißen sonst „file_0000…").
    if (arr.length === 1) {
      setNameTarget(arr[0]);
      setNameValue(arr[0].name.replace(/\.[A-Za-z0-9]{1,8}$/, ''));
    } else {
      void doUpload(arr);
    }
  }

  async function toggleVisible(f: ProjectFileItem) {
    try { await setFileVisibility(f.id, !f.visibleToClient); toast.success(f.visibleToClient ? 'Für Kunden verborgen.' : 'Für Kunden freigegeben.'); router.refresh(); }
    catch { toast.error('Aktion fehlgeschlagen.'); }
  }
  async function remove(f: ProjectFileItem) {
    try { await deleteProjectFile(f.id); toast.success('Datei gelöscht.'); router.refresh(); }
    catch { toast.error('Konnte Datei nicht löschen.'); }
  }

  async function submitNewFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setSavingFolder(true);
    try {
      await createFolder(projectId, name, currentFolderId);
      toast.success('Ordner erstellt.');
      setNewFolderOpen(false); setNewFolderName('');
      router.refresh();
    } catch { toast.error('Ordner konnte nicht erstellt werden.'); }
    setSavingFolder(false);
  }

  async function submitRename() {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) return;
    setRenaming(true);
    try {
      await renameFolder(renameTarget.id, name);
      toast.success('Ordner umbenannt.');
      setRenameTarget(null);
      router.refresh();
    } catch { toast.error('Ordner konnte nicht umbenannt werden.'); }
    setRenaming(false);
  }

  async function confirmDeleteFolder() {
    if (!deleteTarget) return;
    setDeletingFolder(true);
    try {
      await deleteFolder(deleteTarget.id);
      toast.success('Ordner gelöscht.');
      // If we were inside it, step up to its parent.
      if (currentFolderId === deleteTarget.id) setCurrentFolderId(deleteTarget.parentId);
      setDeleteTarget(null);
      router.refresh();
    } catch { toast.error('Ordner konnte nicht gelöscht werden.'); }
    setDeletingFolder(false);
  }

  async function toggleFolderVisible(f: FolderItem) {
    try {
      await setFolderVisible(f.id, !f.visibleToClient);
      toast.success(f.visibleToClient ? 'Ordner für Kunden verborgen.' : 'Ordner für Kunden sichtbar.');
      router.refresh();
    } catch { toast.error('Aktion fehlgeschlagen.'); }
  }

  async function submitMove() {
    if (!moveTarget) return;
    setMoving(true);
    try {
      await moveFileToFolder(moveTarget.id, moveDest || null);
      toast.success('Datei verschoben.');
      setMoveTarget(null);
      router.refresh();
    } catch { toast.error('Datei konnte nicht verschoben werden.'); }
    setMoving(false);
  }

  const empty = subfolders.length === 0 && visibleFiles.length === 0;

  return (
    <div style={{ border: '1px solid #E4E3DF', borderRadius: 20, padding: '18px 20px', marginBottom: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: '#909090' }}>Dateien</div>
        {canUpload && (
          <button
            onClick={() => { setNewFolderName(''); setNewFolderOpen(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 8, border: '1.5px solid #E4E3DF', background: '#fff', color: '#1C1B18', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            <FolderPlus size={14} style={{ color: 'var(--accent)' }} /> Neuer Ordner
          </button>
        )}
      </div>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, marginBottom: 12, fontSize: 12.5 }}>
        <button onClick={() => setCurrentFolderId(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 7, border: 'none', background: currentFolderId === null ? 'var(--wash)' : 'transparent', color: currentFolderId === null ? '#1C1B18' : '#909090', fontWeight: 600, cursor: 'pointer' }}>
          <Folder size={13} /> Dateien
        </button>
        {path.map((f, i) => {
          const isLast = i === path.length - 1;
          return (
            <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <ChevronRight size={13} style={{ color: '#C4C4C0' }} />
              <button onClick={() => setCurrentFolderId(f.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 7, border: 'none', background: isLast ? 'var(--wash)' : 'transparent', color: isLast ? '#1C1B18' : '#909090', fontWeight: 600, cursor: 'pointer' }}>
                {f.name}
              </button>
            </span>
          );
        })}
      </div>

      {canUpload && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          style={{ border: `1.5px dashed ${drag ? 'var(--accent)' : '#E4E3DF'}`, borderRadius: 12, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 12, cursor: 'pointer', background: drag ? 'rgba(var(--accent-rgb),.04)' : 'transparent', transition: 'border-color .16s, background .16s' }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#EDECE9', color: '#505050', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {uploading ? <Spinner size={15} /> : <Upload size={15} />}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1B18' }}>{uploading ? 'Wird hochgeladen…' : currentFolderId ? `Hochladen in „${path[path.length - 1]?.name}"` : 'Datei hochladen'}</span>
          <span style={{ fontSize: 11, color: '#909090' }}>Klicken oder hierher ziehen · max. 50 MB</span>
          <input ref={inputRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
      )}

      {empty ? (
        <div style={{ fontSize: 13, color: '#b0b0b0', padding: '6px 0' }}>{currentFolderId ? 'Dieser Ordner ist leer.' : 'Noch keine Dateien.'}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Subfolders */}
          {subfolders.map((fd) => {
            const actions: DropdownItem[] = [
              { label: 'Öffnen', icon: <FolderOpen size={14} />, onClick: () => setCurrentFolderId(fd.id) },
            ];
            if (canUpload) actions.push({ label: 'Umbenennen', icon: <Pencil size={14} />, onClick: () => { setRenameTarget(fd); setRenameName(fd.name); } });
            if (canRelease) actions.push({ label: fd.visibleToClient ? 'Für Kunden verbergen' : 'Für Kunden sichtbar', icon: fd.visibleToClient ? <EyeOff size={14} /> : <Eye size={14} />, onClick: () => toggleFolderVisible(fd) });
            if (canDelete) actions.push({ label: 'Löschen', icon: <Trash2 size={14} />, onClick: () => setDeleteTarget(fd), danger: true });
            return (
              <div key={fd.id} className="file-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: '#F9F9F8', border: '1px solid #F0EFEC' }}>
                <button onClick={() => setCurrentFolderId(fd.id)} title="Öffnen" style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
                  <Folder size={15} />
                </button>
                <button onClick={() => setCurrentFolderId(fd.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1C1B18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fd.name}</span>
                    {fd.visibleToClient && <Chip variant="accent" style={{ fontSize: 9.5, padding: '2px 7px' }}>sichtbar</Chip>}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#909090' }}>Ordner</div>
                </button>
                <div className="file-actions" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <DropdownMenu
                    trigger={<button title="Aktionen" style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#909090', border: 'none', background: 'transparent', cursor: 'pointer' }}><MoreVertical size={14} /></button>}
                    items={actions}
                  />
                </div>
              </div>
            );
          })}

          {/* Files in this folder */}
          {visibleFiles.map((f) => {
            const fileActions = [
              ...(channelId ? [{ label: 'Im Chat referenzieren', icon: <MessageSquare size={14} />, onClick: () => shareToChat(f) }] : []),
              ...(canUpload ? [
                { label: 'Umbenennen', icon: <Pencil size={14} />, onClick: () => { setRenameFile(f); setRenameFileValue(f.name.replace(/\.[A-Za-z0-9]{1,8}$/, '')); } },
                { label: 'Verschieben', icon: <FolderInput size={14} />, onClick: () => { setMoveTarget(f); setMoveDest(f.folderId ?? ''); } },
              ] : []),
            ];
            return (
              <div key={f.id} className="file-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: '#F9F9F8', border: '1px solid #F0EFEC' }}>
                <button onClick={() => setPreview(f)} title="Vorschau öffnen" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: '#0A0A0A', color: '#fff', fontSize: 8.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '.02em' }}>
                    {fileTypeLabel(f.mimeType, f.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#1C1B18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                    <div style={{ fontSize: 10.5, color: '#909090', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formatBytes(f.size)} · {f.uploaderType === 'client_user' ? `Kunde (${f.uploaderName})` : f.uploaderName}
                      {f.createdAt && <> · <TimeAgo value={f.createdAt} /></>}
                      {f.visibleToClient ? ' · für Kunde sichtbar' : ''}
                    </div>
                  </div>
                </button>
                <div className="file-actions" style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  {canRelease && (
                    <button onClick={() => toggleVisible(f)} title={f.visibleToClient ? 'Für Kunden verbergen' : 'Für Kunden freigeben'} style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.visibleToClient ? 'var(--accent)' : '#909090' }}>
                      {f.visibleToClient ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  )}
                  <a href={`/api/files/${f.id}?dl=1`} title="Herunterladen" style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#505050' }}><Download size={14} /></a>
                  {fileActions.length > 0 && (
                    <DropdownMenu
                      trigger={<button title="Mehr" style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#909090', border: 'none', background: 'transparent', cursor: 'pointer' }}><MoreVertical size={14} /></button>}
                      items={fileActions}
                    />
                  )}
                  {canDelete && (
                    <button onClick={() => remove(f)} title="Löschen" style={{ width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C4C4C0' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#C4C4C0'; }}><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Datei-Vorschau */}
      <FilePreviewModal
        file={preview}
        onClose={() => setPreview(null)}
        onShareToChat={channelId ? shareToChat : undefined}
      />

      {/* Anzeigename beim Einzel-Upload */}
      <Modal open={!!nameTarget} onClose={() => !uploading && setNameTarget(null)} title="Datei benennen" subtitle={nameTarget ? `Original: ${nameTarget.name}` : undefined} width={440}
        footer={<>
          <Button variant="secondary" onClick={() => setNameTarget(null)} disabled={uploading}>Abbrechen</Button>
          <Button loading={uploading} onClick={async () => { if (nameTarget) { await doUpload([nameTarget], nameValue.trim() || undefined); setNameTarget(null); } }}>Hochladen</Button>
        </>}>
        <Field label="Anzeigename" hint="Die Dateiendung bleibt automatisch erhalten.">
          <Input autoFocus value={nameValue} onChange={(e) => setNameValue(e.target.value)} onKeyDown={async (e) => { if (e.key === 'Enter' && nameTarget) { await doUpload([nameTarget], nameValue.trim() || undefined); setNameTarget(null); } }} placeholder="z. B. Logo-Entwurf v2" />
        </Field>
      </Modal>

      {/* Datei umbenennen */}
      <Modal open={!!renameFile} onClose={() => setRenameFile(null)} title="Datei umbenennen" subtitle={renameFile?.name} width={440}
        footer={<>
          <Button variant="secondary" onClick={() => setRenameFile(null)}>Abbrechen</Button>
          <Button onClick={async () => {
            if (!renameFile || !renameFileValue.trim()) return;
            try { await renameProjectFile(renameFile.id, renameFileValue); toast.success('Datei umbenannt.'); setRenameFile(null); router.refresh(); }
            catch { toast.error('Umbenennen fehlgeschlagen.'); }
          }}>Speichern</Button>
        </>}>
        <Field label="Neuer Name" hint="Die Dateiendung bleibt automatisch erhalten.">
          <Input autoFocus value={renameFileValue} onChange={(e) => setRenameFileValue(e.target.value)} />
        </Field>
      </Modal>

      {/* New folder modal */}
      <Modal
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="Neuer Ordner"
        subtitle={currentFolderId ? `In „${path[path.length - 1]?.name}"` : 'Auf der Hauptebene'}
        width={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewFolderOpen(false)}>Abbrechen</Button>
            <Button onClick={submitNewFolder} loading={savingFolder}>Erstellen</Button>
          </>
        }
      >
        <Field label="Name">
          <Input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitNewFolder(); }} placeholder="z. B. Designs" />
        </Field>
      </Modal>

      {/* Rename folder modal */}
      <Modal
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Ordner umbenennen"
        width={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>Abbrechen</Button>
            <Button onClick={submitRename} loading={renaming}>Speichern</Button>
          </>
        }
      >
        <Field label="Name">
          <Input autoFocus value={renameName} onChange={(e) => setRenameName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); }} />
        </Field>
      </Modal>

      {/* Move file modal */}
      <Modal
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        title="Datei verschieben"
        subtitle={moveTarget?.name}
        width={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveTarget(null)}>Abbrechen</Button>
            <Button onClick={submitMove} loading={moving}>Verschieben</Button>
          </>
        }
      >
        <Field label="Zielordner">
          <Select value={moveDest} onChange={(e) => setMoveDest(e.target.value)}>
            <option value="">— Hauptebene —</option>
            {folderOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Select>
        </Field>
      </Modal>

      {/* Delete folder confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteFolder}
        loading={deletingFolder}
        danger
        title="Ordner löschen?"
        message={`Der Ordner „${deleteTarget?.name ?? ''}" wird gelöscht. Enthaltene Dateien und Unterordner werden eine Ebene nach oben verschoben.`}
        confirmLabel="Ordner löschen"
      />
    </div>
  );
}
