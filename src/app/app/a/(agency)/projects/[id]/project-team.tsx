'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings2, Check, Users, MessageSquare } from 'lucide-react';
import { Drawer, Button, useToast } from '@/components/ui';
import { getInitials } from '@/lib/utils';
import { setProjectMembers, setChatBypass } from '../actions';

interface Member { id: string; name: string; role: string }

export function ProjectTeam({
  projectId, members, assignable, chatBypass, canEdit,
}: {
  projectId: string;
  members: Member[];
  assignable: Member[];
  chatBypass: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>(members.map((m) => m.id));
  const [bypass, setBypass] = useState(chatBypass);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function save() {
    setSaving(true);
    try {
      await setProjectMembers(projectId, selected);
      await setChatBypass(projectId, bypass);
      toast.success('Team & Chat-Zugang gespeichert.');
      setOpen(false);
      router.refresh();
    } catch { toast.error('Speichern fehlgeschlagen.'); }
    setSaving(false);
  }

  return (
    <div style={{ border: '1px solid #E4E3DF', borderRadius: 20, padding: '18px 20px', marginBottom: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: '#909090' }}>Team & Chat-Zugang</div>
        {canEdit && (
          <button onClick={() => { setSelected(members.map((m) => m.id)); setBypass(chatBypass); setOpen(true); }} title="Verwalten" style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E4E3DF', background: '#fff', color: '#505050', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Settings2 size={14} /></button>
        )}
      </div>

      {members.length === 0 ? (
        <div style={{ fontSize: 13, color: '#b0b0b0' }}>Keine Mitglieder zugewiesen.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {members.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#0A0A0A', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{getInitials(m.name)}</div>
              <div><div style={{ fontSize: 13, fontWeight: 600, color: '#1C1B18' }}>{m.name}</div><div style={{ fontSize: 11, color: '#909090', textTransform: 'capitalize' }}>{m.role}</div></div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F0EFEC', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#909090' }}>
        <MessageSquare size={13} />
        {chatBypass
          ? 'Kunde kann mit allen Agentur-Usern chatten (Bypass aktiv).'
          : 'Kunde kann nur mit den zugewiesenen Mitgliedern chatten.'}
      </div>

      <Drawer open={open} onClose={() => !saving && setOpen(false)} title="Team & Chat-Zugang" subtitle="Wählen Sie, welche Mitglieder am Projekt arbeiten — sie sind die Ansprechpartner, denen der Kunde schreiben darf." width={460}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Abbrechen</Button><Button onClick={save} loading={saving}>Speichern</Button></>}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#909090', marginBottom: 12 }}>Zugewiesene Mitglieder</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
          {assignable.map((m) => {
            const on = selected.includes(m.id);
            return (
              <button key={m.id} type="button" onClick={() => toggle(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${on ? 'var(--accent)' : '#E4E3DF'}`, background: on ? 'rgba(var(--accent-rgb),.05)' : '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all .14s var(--ease)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0A0A0A', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{getInitials(m.name)}</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A0A0A' }}>{m.name}</div><div style={{ fontSize: 11, color: '#909090', textTransform: 'capitalize' }}>{m.role}</div></div>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: on ? 'var(--accent)' : 'transparent', border: on ? 'none' : '1.5px solid #E4E3DF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on && <Check size={13} />}</span>
              </button>
            );
          })}
          {assignable.length === 0 && <div style={{ fontSize: 13, color: '#909090' }}>Keine aktiven Team-Mitglieder.</div>}
        </div>

        <button type="button" onClick={() => setBypass((b) => !b)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${bypass ? 'var(--accent)' : '#E4E3DF'}`, background: bypass ? 'rgba(var(--accent-rgb),.05)' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
          <Users size={18} color={bypass ? 'var(--accent)' : '#909090'} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0A0A0A' }}>Chat-Bypass</div>
            <div style={{ fontSize: 11.5, color: '#909090', lineHeight: 1.4 }}>Kunde darf mit <strong>allen</strong> Agentur-Usern chatten, nicht nur den zugewiesenen.</div>
          </div>
          <span style={{ width: 42, height: 24, borderRadius: 100, background: bypass ? 'var(--accent)' : '#E4E3DF', position: 'relative', flexShrink: 0, transition: 'background .16s' }}>
            <span style={{ position: 'absolute', top: 2, left: bypass ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .16s var(--ease)' }} />
          </span>
        </button>
      </Drawer>
    </div>
  );
}
