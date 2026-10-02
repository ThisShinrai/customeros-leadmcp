'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { useToast, Spinner, Select } from '@/components/ui';
import { uploadClientFile } from '@/app/app/p/(portal)/[slug]/file-actions';

interface ProjectOption {
  id: string;
  name: string;
}

export function PortalFileUpload({ projects }: { projects: ProjectOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState(projects.length === 1 ? projects[0].id : '');
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);

  async function upload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    if (!projectId) { toast.error('Bitte wählen Sie zuerst ein Projekt.'); return; }
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const fd = new FormData();
        fd.set('projectId', projectId);
        fd.set('file', file);
        await uploadClientFile(fd);
      }
      toast.success(fileList.length === 1 ? 'Datei hochgeladen.' : `${fileList.length} Dateien hochgeladen.`);
      router.refresh();
    } catch (e) {
      const msg = String((e as Error).message);
      toast.error(msg.includes('TOO_LARGE') ? 'Datei zu groß (max. 50 MB).' : msg.includes('FORBIDDEN') ? 'Keine Berechtigung für dieses Projekt.' : 'Upload fehlgeschlagen.');
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  if (projects.length === 0) return null;

  return (
    <div style={{ border: '1px solid #E4E3DF', borderRadius: 16, padding: '18px 20px', background: '#fff', marginBottom: 22 }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.12em', color: '#909090', marginBottom: 14 }}>Datei hochladen</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Projekt wählen…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>

        <div
          onClick={() => { if (!projectId) { toast.error('Bitte wählen Sie zuerst ein Projekt.'); return; } inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          style={{ border: `1.5px dashed ${drag ? 'var(--accent)' : '#E4E3DF'}`, borderRadius: 12, padding: '22px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', background: drag ? 'rgba(var(--accent-rgb),.04)' : 'transparent', transition: 'border-color .16s, background .16s' }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#EDECE9', color: '#505050', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {uploading ? <Spinner size={15} /> : <Upload size={15} />}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1B18' }}>{uploading ? 'Wird hochgeladen…' : 'Datei auswählen oder hierher ziehen'}</span>
          <span style={{ fontSize: 11, color: '#909090' }}>max. 50 MB</span>
          <input ref={inputRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
      </div>
    </div>
  );
}
