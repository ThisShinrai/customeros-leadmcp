'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, PencilRuler, Users, Check, Loader2, Radio } from 'lucide-react';
import { WhiteboardEditor, type WhiteboardScene, type SaveStatus } from '@/components/whiteboard/whiteboard-editor';
import { savePortalWhiteboardScene, syncPortalWhiteboard } from '../actions';

interface Props {
  slug: string;
  boardId: string;
  boardName: string;
  projectId: string;
  projectName: string;
  initialScene: WhiteboardScene | null;
  initialVersion: number;
}

export function PortalWhiteboard({ slug, boardId, boardName, projectId, projectName, initialScene, initialVersion }: Props) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [remoteBy, setRemoteBy] = useState<string | null>(null);

  return (
    <div data-fullbleed style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 16px)', overflow: 'hidden' }}>
      <header style={{ height: 56, flexShrink: 0, borderBottom: '1px solid #EDECE9', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', background: '#fff', zIndex: 5 }}>
        <Link href={`/app/p/${slug}/projekte/${projectId}`} title={projectName} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#909090', flexShrink: 0 }}>
          <ArrowLeft size={15} /> <span className="cos-desktop-only">{projectName}</span>
        </Link>
        <span className="cos-desktop-only" style={{ width: 1, height: 18, background: '#E4E3DF' }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-.2px', minWidth: 0, flex: '0 1 auto' }}>
          <PencilRuler size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{boardName}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', background: 'rgba(var(--accent-rgb),.1)', borderRadius: 100, padding: '3px 9px', flexShrink: 0 }}>
          <Radio size={10} /> LIVE
        </span>
        <SaveBadge status={status} />
        {remoteBy && (
          <span className="cos-desktop-only" style={{ fontSize: 11, color: '#909090', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Users size={11} /> aktualisiert von {remoteBy}
          </span>
        )}
      </header>

      <div style={{ flex: 1, position: 'relative', background: '#fff' }}>
        <WhiteboardEditor
          boardId={boardId}
          initialScene={initialScene}
          initialVersion={initialVersion}
          canEdit
          saveAction={savePortalWhiteboardScene}
          syncAction={syncPortalWhiteboard}
          onStatusChange={setStatus}
          onRemoteUpdate={setRemoteBy}
        />
      </div>

      <style>{`.wb-spin { animation: spin 1s linear infinite; }`}</style>
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
