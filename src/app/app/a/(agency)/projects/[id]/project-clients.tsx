'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings2, Check } from 'lucide-react';
import { Drawer, Button, useToast } from '@/components/ui';
import { getInitials } from '@/lib/utils';
import { setProjectClients } from '../actions';

interface ClientItem { id: string; name: string; company: string | null }

export function ProjectClients({
  projectId, clients, assignable, canEdit,
}: {
  projectId: string;
  clients: ClientItem[];
  assignable: ClientItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>(clients.map((c) => c.id));

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function save() {
    setSaving(true);
    try {
      await setProjectClients(projectId, selected);
      toast.success('Kunden-Zuordnung gespeichert.');
      setOpen(false);
      router.refresh();
    } catch { toast.error('Speichern fehlgeschlagen.'); }
    setSaving(false);
  }

  return (
    <div style={{ border: '1px solid #E4E3DF', borderRadius: 20, padding: '18px 20px', marginBottom: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: '#909090' }}>Kunden</div>
        {canEdit && (
          <button onClick={() => { setSelected(clients.map((c) => c.id)); setOpen(true); }} title="Kunden verwalten" style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E4E3DF', background: '#fff', color: '#505050', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Settings2 size={14} /></button>
        )}
      </div>

      {clients.length === 0 ? (
        <div style={{ fontSize: 13, color: '#b0b0b0' }}>Kein Kunde zugeordnet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {clients.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{getInitials(c.name)}</div>
              <div><div style={{ fontSize: 13, fontWeight: 600, color: '#1C1B18' }}>{c.name}</div>{c.company && <div style={{ fontSize: 11, color: '#909090' }}>{c.company}</div>}</div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={open} onClose={() => !saving && setOpen(false)} title="Kunden zuordnen" subtitle="Zugeordnete Kunden sehen dieses Projekt in ihrem Portal und werden dem Projekt-Chat hinzugefügt." width={460}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Abbrechen</Button><Button onClick={save} loading={saving}>Speichern</Button></>}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#909090', marginBottom: 12 }}>Zugeordnete Kunden</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {assignable.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggle(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${on ? 'var(--accent)' : '#E4E3DF'}`, background: on ? 'rgba(var(--accent-rgb),.05)' : '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all .14s var(--ease)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{getInitials(c.name)}</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A0A0A' }}>{c.name}</div>{c.company && <div style={{ fontSize: 11, color: '#909090' }}>{c.company}</div>}</div>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: on ? 'var(--accent)' : 'transparent', border: on ? 'none' : '1.5px solid #E4E3DF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on && <Check size={13} />}</span>
              </button>
            );
          })}
          {assignable.length === 0 && <div style={{ fontSize: 13, color: '#909090' }}>Noch keine Kunden angelegt — lade zuerst unter „Kunden" jemanden ein.</div>}
        </div>
      </Drawer>
    </div>
  );
}
