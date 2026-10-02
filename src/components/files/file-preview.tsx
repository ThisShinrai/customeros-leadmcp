'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, MessageSquare, FileQuestion } from 'lucide-react';
import { Modal, Button, Spinner } from '@/components/ui';
import { fmtDateTime } from '@/lib/invoices/format';

/**
 * In-App-Dateivorschau: Bilder, PDFs, Text-/Code-Dateien, Video und Audio
 * direkt anzeigen; alles andere bekommt einen sauberen Download-Fallback.
 * Die Inhalte kommen über die auth-geprüfte /api/files/[id]-Route (inline).
 */

export interface PreviewFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploaderName: string;
  uploaderType: 'agency_user' | 'client_user';
  createdAt: Date | null;
}

type Kind = 'image' | 'pdf' | 'text' | 'video' | 'audio' | 'other';

const TEXT_EXT = /\.(txt|md|csv|json|xml|html?|css|js|jsx|ts|tsx|yml|yaml|toml|ini|log|sql|sh|py|php)$/i;

function kindOf(f: PreviewFile): Kind {
  const m = (f.mimeType || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('text/') || m.includes('json') || m.includes('xml') || TEXT_EXT.test(f.name)) return 'text';
  return 'other';
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FilePreviewModal({ file, onClose, onShareToChat }: {
  file: PreviewFile | null;
  onClose: () => void;
  onShareToChat?: (file: PreviewFile) => void;
}) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);

  const kind = file ? kindOf(file) : 'other';
  const url = file ? `/api/files/${file.id}` : '';

  useEffect(() => {
    setTextContent(null);
    if (!file || kindOf(file) !== 'text') return;
    setTextLoading(true);
    fetch(`/api/files/${file.id}`)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => setTextContent(t.length > 200_000 ? `${t.slice(0, 200_000)}\n\n… (gekürzt)` : t))
      .catch(() => setTextContent('Inhalt konnte nicht geladen werden.'))
      .finally(() => setTextLoading(false));
  }, [file]);

  if (!file) return null;

  const meta = [
    file.uploaderType === 'client_user' ? `Kunde (${file.uploaderName})` : file.uploaderName,
    file.createdAt ? fmtDateTime(new Date(file.createdAt)) : null,
    formatBytes(file.size),
  ].filter(Boolean).join(' · ');

  return (
    <Modal open onClose={onClose} title={file.name} subtitle={`Hochgeladen von ${meta}`} width={780}
      footer={
        <>
          {onShareToChat && (
            <Button variant="secondary" icon={<MessageSquare size={14} />} onClick={() => onShareToChat(file)}>Im Chat teilen</Button>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="secondary" icon={<ExternalLink size={14} />} onClick={() => window.open(url, '_blank')}>Neuer Tab</Button>
          <Button icon={<Download size={14} />} onClick={() => { window.location.href = `${url}?dl=1`; }}>Herunterladen</Button>
        </>
      }>
      <div style={{ borderRadius: 14, overflow: 'hidden', background: kind === 'image' || kind === 'video' ? '#0A0A0A' : '#FAF9F6', border: '1px solid #EDECE8', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.name} style={{ maxWidth: '100%', maxHeight: '62vh', objectFit: 'contain', display: 'block' }} />
        )}
        {kind === 'pdf' && (
          <iframe src={url} title={file.name} style={{ width: '100%', height: '62vh', border: 'none', background: '#fff' }} />
        )}
        {kind === 'video' && (
          <video src={url} controls style={{ maxWidth: '100%', maxHeight: '62vh' }} />
        )}
        {kind === 'audio' && (
          <div style={{ padding: '40px 24px', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <audio src={url} controls style={{ width: '100%', maxWidth: 480 }} />
          </div>
        )}
        {kind === 'text' && (
          textLoading ? <div style={{ padding: 40 }}><Spinner /></div> : (
            <pre style={{ margin: 0, padding: '18px 20px', width: '100%', maxHeight: '62vh', overflow: 'auto', fontSize: 12.5, lineHeight: 1.6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#1C1B18', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{textContent}</pre>
          )
        )}
        {kind === 'other' && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#909090' }}>
            <FileQuestion size={34} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#505050' }}>Keine Vorschau für diesen Dateityp</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{file.mimeType || 'Unbekannter Typ'} — einfach herunterladen.</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
