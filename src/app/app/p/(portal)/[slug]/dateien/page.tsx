import { FileText, Download, FolderUp, Inbox, Folder } from 'lucide-react';
import { requirePortalSession } from '@/lib/auth/session';
import { EmptyState, BentoCard } from '@/components/ui';
import { PortalHeader } from '@/components/portal/portal-header';
import { PortalFileUpload } from '@/components/portal/portal-file-upload';
import { formatBytes, fileTypeLabel, formatDate } from '@/lib/utils';
import { getClientFiles, getClientFolders, getClientProjects, type PortalFileItem } from '../queries';

function Label({ children, color = '#909090' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color, lineHeight: 1 }}>{children}</span>;
}

function FileRow({ f }: { f: PortalFileItem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: '#F9F9F8', border: '1px solid #F0EFEC' }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: '#0A0A0A', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '.02em' }}>
        {fileTypeLabel(f.mimeType, f.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1C1B18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
        <div style={{ fontSize: 11.5, color: '#909090', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {f.projectName || 'Projekt'} · {formatBytes(f.size)}{f.createdAt ? ` · ${formatDate(f.createdAt)}` : ''}
        </div>
      </div>
      <a href={`/api/files/${f.id}?dl=1`} title="Herunterladen" style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#505050', flexShrink: 0, border: '1px solid #E4E3DF', background: '#fff' }}>
        <Download size={15} />
      </a>
    </div>
  );
}

function GroupCard({ title, count, emptyIcon, emptyText, items }: { title: string; count: number; emptyIcon: React.ReactNode; emptyText: string; items: PortalFileItem[] }) {
  return (
    <BentoCard interactive={false} padding="20px 22px">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Label color="#0A0A0A">{title}</Label>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#909090', background: '#EDECE9', borderRadius: 100, padding: '2px 9px', lineHeight: 1.4 }}>{count}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#b0b0b0', padding: '4px 2px' }}>
          {emptyIcon} {emptyText}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((f) => <FileRow key={f.id} f={f} />)}
        </div>
      )}
    </BentoCard>
  );
}

interface FileGroup { id: string | null; name: string; items: PortalFileItem[] }

function FolderHeader({ name, count }: { name: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Folder size={13} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1B18' }}>{name}</span>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#909090', background: '#EDECE9', borderRadius: 100, padding: '1px 8px', lineHeight: 1.4 }}>{count}</span>
    </div>
  );
}

/** Agency-released files, grouped into client-visible folders + an „Allgemein" root bucket. */
function AgencyFilesCard({ groups, total }: { groups: FileGroup[]; total: number }) {
  return (
    <BentoCard interactive={false} padding="20px 22px">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Label color="#0A0A0A">Von Ihrer Agentur</Label>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#909090', background: '#EDECE9', borderRadius: 100, padding: '2px 9px', lineHeight: 1.4 }}>{total}</span>
      </div>
      {groups.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#b0b0b0', padding: '4px 2px' }}>
          <Inbox size={15} /> Es wurden noch keine Dateien für Sie freigegeben.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map((g) => (
            <div key={g.id ?? 'root'} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {g.id !== null && <FolderHeader name={g.name} count={g.items.length} />}
              {g.items.length === 0 ? (
                <div style={{ fontSize: 12.5, color: '#b0b0b0', padding: '2px 2px 2px 32px' }}>Leer</div>
              ) : (
                g.items.map((f) => <FileRow key={f.id} f={f} />)
              )}
            </div>
          ))}
        </div>
      )}
    </BentoCard>
  );
}

export default async function PortalFilesPage({ params }: { params: Promise<{ slug: string }> }) {
  await params;
  const session = await requirePortalSession();
  const [files, projects, folders] = await Promise.all([
    getClientFiles(session.agencyId, session.client.id),
    getClientProjects(session.agencyId, session.client.id),
    getClientFolders(session.agencyId, session.client.id),
  ]);

  const released = files.filter((f) => !f.mine);
  const mine = files.filter((f) => f.mine);
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));

  // Group released files into client-visible folders; everything else → „Allgemein".
  const visibleFolderIds = new Set(folders.map((f) => f.id));
  const byFolder = new Map<string, PortalFileItem[]>();
  const rootFiles: PortalFileItem[] = [];
  for (const f of released) {
    if (f.folderId && visibleFolderIds.has(f.folderId)) {
      const arr = byFolder.get(f.folderId) ?? [];
      arr.push(f);
      byFolder.set(f.folderId, arr);
    } else {
      rootFiles.push(f);
    }
  }
  // Show a folder header for every visible folder (even empty) + the root bucket when non-empty.
  const agencyGroups: FileGroup[] = [
    ...(rootFiles.length ? [{ id: null, name: 'Allgemein', items: rootFiles }] : []),
    ...folders
      .map((fd) => ({ id: fd.id, name: fd.name, items: byFolder.get(fd.id) ?? [] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de')),
  ];

  return (
    <div className="page-transition">
      <PortalHeader
        title="Dateien"
        subtitle={`${files.length} Datei${files.length === 1 ? '' : 'en'}`}
        clientName={session.client.name}
        avatarUrl={session.client.avatarUrl}
        avatarFrameColor={session.client.avatarFrameColor}
      />

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 style={{ fontSize: 33, fontWeight: 800, letterSpacing: '-1.4px', color: '#0A0A0A', margin: 0, lineHeight: 1.02 }}>Dateien</h1>

        <PortalFileUpload projects={projectOptions} />

        {files.length === 0 ? (
          <BentoCard interactive={false} padding={0}>
            <EmptyState
              icon={<FileText size={24} />}
              title="Noch keine Dateien"
              description="Hier erscheinen von Ihrer Agentur freigegebene Dateien sowie Ihre eigenen Uploads."
            />
          </BentoCard>
        ) : (
          <div className="files-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
            <AgencyFilesCard groups={agencyGroups} total={released.length} />
            <GroupCard
              title="Meine Uploads"
              count={mine.length}
              emptyIcon={<FolderUp size={15} />}
              emptyText="Sie haben noch keine Dateien hochgeladen."
              items={mine}
            />
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 900px) {
          .files-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
