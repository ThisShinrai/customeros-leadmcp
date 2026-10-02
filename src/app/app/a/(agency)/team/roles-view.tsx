'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, ShieldCheck, Plus, Copy, Trash2, Pencil, Check,
  Users, Lock, KeyRound,
} from 'lucide-react';
import {
  Drawer, ConfirmDialog, Button, Field, Input, DropdownMenu, useToast,
  BentoCard, type DropdownItem,
} from '@/components/ui';
import { PERMISSION_GROUPS, type PermissionKey } from '@/lib/permissions';
import { PERMISSION_LABELS, PERMISSION_HINTS } from './permission-labels';
import { createRole, updateRole, duplicateRole, deleteRole, setUserRoles } from './roles-actions';
import type { RoleItem } from './roles-queries';
import type { TeamMember } from './queries';

const ease = 'cubic-bezier(.16,1,.3,1) .22s';

const TOTAL_PERMS = PERMISSION_GROUPS.reduce((n, g) => n + g.keys.length, 0);

/* ─── small section label (matches team-view) ──────────────────── */

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.14em', color: '#909090',
      }}>
        {children}
      </span>
      {count !== undefined && (
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#909090',
          background: '#EDECE9', borderRadius: 100, padding: '1px 7px', lineHeight: 1.6,
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

/* ─── assigned-role chip (shown on member rows) ────────────────── */

export function AssignedRoleChip({ name }: { name: string }) {
  return (
    <span style={{
      borderRadius: 100, border: '1px solid #E4E3DF',
      fontSize: 10, fontWeight: 600, padding: '3px 9px 3px 7px',
      color: '#505050', background: '#fff',
      display: 'inline-flex', alignItems: 'center', gap: 4,
      lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      <Shield size={9} style={{ color: 'var(--accent)' }} />
      {name}
    </span>
  );
}

/* ─── default badge ────────────────────────────────────────────── */

function DefaultBadge() {
  return (
    <span style={{
      borderRadius: 100, border: '1px solid #0A0A0A',
      fontSize: 9.5, fontWeight: 700, padding: '2px 8px',
      color: '#fff', background: '#0A0A0A',
      display: 'inline-flex', alignItems: 'center', gap: 3,
      lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0,
      textTransform: 'uppercase', letterSpacing: '.06em',
    }}>
      <ShieldCheck size={10} /> Standard
    </span>
  );
}

/* ─── meta pill (perms count / users count) ─────────────────────── */

function MetaPill({ icon, label, hovered }: { icon: React.ReactNode; label: string; hovered: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11.5, fontWeight: 600, lineHeight: 1,
      color: hovered ? 'rgba(255,255,255,.7)' : '#909090',
      transition: `color ${ease}`,
    }}>
      <span style={{ display: 'flex', color: hovered ? 'rgba(255,255,255,.55)' : '#b0b0b0', transition: `color ${ease}` }}>{icon}</span>
      {label}
    </span>
  );
}

/* ─── role card ────────────────────────────────────────────────── */

function RoleCard({
  role, canManage, onEdit, onDuplicate, onDelete,
}: {
  role: RoleItem;
  canManage: boolean;
  onEdit: (r: RoleItem) => void;
  onDuplicate: (r: RoleItem) => void;
  onDelete: (r: RoleItem) => void;
}) {
  const [hover, setHover] = useState(false);
  const inUse = role.userCount > 0;

  const items: DropdownItem[] = [
    { label: 'Bearbeiten', icon: <Pencil size={15} />, onClick: () => onEdit(role) },
    { label: 'Duplizieren', icon: <Copy size={15} />, onClick: () => onDuplicate(role) },
    { label: 'Löschen', icon: <Trash2 size={15} />, danger: true, onClick: () => onDelete(role) },
  ];

  return (
    <BentoCard
      padding={20}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => canManage && onEdit(role)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 16, minHeight: 150,
        cursor: canManage ? 'pointer' : 'default',
        background: hover ? '#0A0A0A' : '#fff',
        borderColor: hover ? '#0A0A0A' : '#E4E3DF',
      }}
    >
      {/* header: icon + name + kebab */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hover ? 'rgba(var(--accent-rgb),.22)' : 'rgba(var(--accent-rgb),.1)',
          color: 'var(--accent)', transition: `background ${ease}`,
        }}>
          <Shield size={18} />
        </span>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{
            fontSize: 16, fontWeight: 800, letterSpacing: '-.4px', lineHeight: 1.15,
            color: hover ? '#fff' : '#0A0A0A', transition: `color ${ease}`,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {role.name}
          </span>
          {role.isDefault && <div><DefaultBadge /></div>}
        </div>

        {canManage && (
          <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
            <DropdownMenu trigger={<Kebab dark={hover} />} items={items} />
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* footer: meta pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <MetaPill
          icon={<KeyRound size={13} />}
          label={`${role.permissions.length}/${TOTAL_PERMS} Rechte`}
          hovered={hover}
        />
        <MetaPill
          icon={<Users size={13} />}
          label={role.userCount === 1 ? '1 Mitglied' : `${role.userCount} Mitglieder`}
          hovered={hover}
        />
        {inUse && (
          <span style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10.5, fontWeight: 600, color: hover ? 'rgba(255,255,255,.5)' : '#b0b0b0',
            transition: `color ${ease}`,
          }}>
            <Lock size={11} /> in Verwendung
          </span>
        )}
      </div>
    </BentoCard>
  );
}

/* ─── kebab (light/dark aware) ─────────────────────────────────── */

function Kebab({ dark }: { dark: boolean }) {
  const [hover, setHover] = useState(false);
  const on = hover;
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Optionen"
      style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: on ? (dark ? 'rgba(255,255,255,.14)' : '#0A0A0A') : 'transparent',
        color: on ? '#fff' : (dark ? 'rgba(255,255,255,.6)' : '#909090'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: 18, lineHeight: 0, letterSpacing: 1,
        transition: `background ${ease}, color ${ease}`,
      }}
    >
      <DotsIcon />
    </span>
  );
}

function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

/* ─── toggle switch ────────────────────────────────────────────── */

function Toggle({ on, onChange, dark }: { on: boolean; onChange: () => void; dark?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      style={{
        width: 38, height: 22, borderRadius: 100, flexShrink: 0, position: 'relative',
        border: 'none', cursor: 'pointer', padding: 0,
        background: on ? 'var(--accent)' : (dark ? 'rgba(255,255,255,.18)' : '#E4E3DF'),
        transition: `background ${ease}`,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 19 : 3,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        transition: `left ${ease}`,
      }} />
    </button>
  );
}

/* ─── permission matrix row ────────────────────────────────────── */

function PermRow({ pkey, on, onToggle }: { pkey: PermissionKey; on: boolean; onToggle: () => void }) {
  const [hover, setHover] = useState(false);
  const hint = PERMISSION_HINTS[pkey];
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', borderRadius: 11, cursor: 'pointer',
        background: hover ? '#F7F6F3' : 'transparent',
        transition: `background ${ease}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A0A0A', lineHeight: 1.3 }}>
          {PERMISSION_LABELS[pkey]}
        </div>
        {hint && <div style={{ fontSize: 11.5, color: '#909090', marginTop: 2, lineHeight: 1.3 }}>{hint}</div>}
      </div>
      <Toggle on={on} onChange={onToggle} />
    </div>
  );
}

/* ─── permission group block ───────────────────────────────────── */

function PermGroup({
  area, keys, selected, onToggleKey, onToggleArea,
}: {
  area: string;
  keys: PermissionKey[];
  selected: Set<PermissionKey>;
  onToggleKey: (k: PermissionKey) => void;
  onToggleArea: (keys: PermissionKey[], next: boolean) => void;
}) {
  const activeCount = keys.filter((k) => selected.has(k)).length;
  const allOn = activeCount === keys.length;

  return (
    <div style={{
      border: '1px solid #E4E3DF', borderRadius: 16, overflow: 'hidden',
      background: '#fff',
    }}>
      {/* group header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', borderBottom: '1px solid #F0EFEC', background: '#FBFAF8',
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: '#0A0A0A',
          letterSpacing: '-.2px', flex: 1,
        }}>
          {area}
        </span>
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: activeCount > 0 ? 'var(--accent)' : '#b0b0b0',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {activeCount}/{keys.length}
        </span>
        <button
          type="button"
          onClick={() => onToggleArea(keys, !allOn)}
          style={{
            fontSize: 11, fontWeight: 700, borderRadius: 100, cursor: 'pointer',
            padding: '4px 10px', border: '1px solid',
            borderColor: allOn ? '#0A0A0A' : '#E4E3DF',
            background: allOn ? '#0A0A0A' : '#fff',
            color: allOn ? '#fff' : '#505050',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            transition: `background ${ease}, color ${ease}, border-color ${ease}`,
          }}
        >
          {allOn && <Check size={12} />}
          Alle
        </button>
      </div>

      {/* rows */}
      <div style={{ padding: 6 }}>
        {keys.map((k) => (
          <PermRow key={k} pkey={k} on={selected.has(k)} onToggle={() => onToggleKey(k)} />
        ))}
      </div>
    </div>
  );
}

/* ─── role editor drawer (create + edit) ───────────────────────── */

export function RoleEditorDrawer({
  open, role, onClose,
}: {
  open: boolean;
  role: RoleItem | null; // null = create mode
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = role !== null;

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<PermissionKey>>(new Set());

  // Re-seed local state whenever a different role (or create) opens.
  const key = `${open ? '1' : '0'}:${role?.id ?? 'new'}`;
  const [lastKey, setLastKey] = useState('');
  if (key !== lastKey) {
    setLastKey(key);
    setName(role?.name ?? '');
    setSelected(new Set(role?.permissions ?? []));
  }

  const selectedCount = selected.size;

  function toggleKey(k: PermissionKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  function toggleArea(keys: PermissionKey[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) { if (on) next.add(k); else next.delete(k); }
      return next;
    });
  }

  function selectAll(on: boolean) {
    if (!on) { setSelected(new Set()); return; }
    const next = new Set<PermissionKey>();
    for (const g of PERMISSION_GROUPS) for (const k of g.keys) next.add(k);
    setSelected(next);
  }

  async function submit() {
    if (!name.trim()) { toast.error('Bitte geben Sie einen Namen für die Rolle ein.'); return; }
    setLoading(true);
    const permissions = [...selected];
    try {
      if (isEdit && role) {
        await updateRole({ id: role.id, name: name.trim(), permissions });
        toast.success('Rolle aktualisiert.');
      } else {
        await createRole({ name: name.trim(), permissions });
        toast.success('Rolle erstellt.');
      }
      onClose();
      router.refresh();
    } catch {
      toast.error(isEdit ? 'Rolle konnte nicht gespeichert werden.' : 'Rolle konnte nicht erstellt werden.');
    } finally {
      setLoading(false);
    }
  }

  const allOn = selectedCount === TOTAL_PERMS;

  return (
    <Drawer
      open={open}
      onClose={() => { if (!loading) onClose(); }}
      title={isEdit ? 'Rolle bearbeiten' : 'Rolle erstellen'}
      subtitle="Legen Sie fest, auf welche Bereiche diese Rolle Zugriff hat."
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading} icon={<Check size={14} />}>
            {isEdit ? 'Speichern' : 'Rolle erstellen'}
          </Button>
        </>
      }
    >
      <Field label="Name der Rolle">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Projektmanager"
          maxLength={60}
          autoFocus
        />
      </Field>

      {/* matrix header with global select-all */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 4,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.12em',
          color: '#909090', flex: 1,
        }}>
          Berechtigungen
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums',
        }}>
          {selectedCount} ausgewählt
        </span>
        <button
          type="button"
          onClick={() => selectAll(!allOn)}
          style={{
            fontSize: 11, fontWeight: 700, borderRadius: 100, cursor: 'pointer',
            padding: '5px 12px', border: '1px solid var(--line)', background: '#fff', color: '#505050',
            transition: `background ${ease}, color ${ease}`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#0A0A0A'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#505050'; }}
        >
          {allOn ? 'Alle abwählen' : 'Alle auswählen'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PERMISSION_GROUPS.map((g) => (
          <PermGroup
            key={g.area}
            area={g.area}
            keys={g.keys}
            selected={selected}
            onToggleKey={toggleKey}
            onToggleArea={toggleArea}
          />
        ))}
      </div>
    </Drawer>
  );
}

/* ─── assign-roles drawer (per member) ─────────────────────────── */

function AssignRow({
  role, on, onToggle,
}: {
  role: RoleItem;
  on: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 13, cursor: 'pointer',
        border: '1px solid',
        borderColor: on ? 'rgba(var(--accent-rgb),.4)' : '#E4E3DF',
        background: on ? 'rgba(var(--accent-rgb),.05)' : (hover ? '#F7F6F3' : '#fff'),
        transition: `background ${ease}, border-color ${ease}`,
      }}
    >
      <span style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: on ? 'var(--accent)' : 'rgba(var(--accent-rgb),.1)',
        color: on ? '#fff' : 'var(--accent)',
        transition: `background ${ease}, color ${ease}`,
      }}>
        <Shield size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-.2px', lineHeight: 1.2 }}>
          {role.name}
        </div>
        <div style={{ fontSize: 11.5, color: '#909090', marginTop: 2 }}>
          {role.permissions.length} Rechte
        </div>
      </div>
      <Toggle on={on} onChange={onToggle} />
    </div>
  );
}

export function AssignRolesDrawer({
  member, roles, assignedRoleIds, onClose,
}: {
  member: TeamMember | null;
  roles: RoleItem[];
  assignedRoleIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const open = member !== null;

  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Re-seed when a different member opens.
  const key = `${open ? '1' : '0'}:${member?.id ?? ''}`;
  const [lastKey, setLastKey] = useState('');
  if (key !== lastKey) {
    setLastKey(key);
    setPicked(new Set(assignedRoleIds));
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!member) return;
    setLoading(true);
    try {
      await setUserRoles(member.id, [...picked]);
      toast.success('Rollen aktualisiert.');
      onClose();
      router.refresh();
    } catch {
      toast.error('Rollen konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => { if (!loading) onClose(); }}
      title="Rollen zuweisen"
      subtitle={member ? `${member.name} · ${member.email}` : undefined}
      width={460}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading} icon={<Check size={14} />}>Speichern</Button>
        </>
      }
    >
      {roles.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px dashed #E4E3DF', borderRadius: 14,
          padding: '28px 24px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 10, textAlign: 'center',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11, background: '#F4F3F0',
            color: '#909090', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={16} />
          </div>
          <span style={{ fontSize: 13, color: '#909090', maxWidth: 300, lineHeight: 1.5 }}>
            Es wurden noch keine Rollen erstellt. Erstellen Sie zuerst eine Rolle, um sie zuweisen zu können.
          </span>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: '#909090', margin: '0 0 14px', lineHeight: 1.5 }}>
            Die Berechtigungen eines Mitglieds ergeben sich aus der Summe aller zugewiesenen Rollen.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {roles.map((r) => (
              <AssignRow key={r.id} role={r} on={picked.has(r.id)} onToggle={() => toggle(r.id)} />
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}

/* ─── roles section (cards grid + create + delete confirm) ─────── */

export function RolesSection({
  roles, canManage, onCreate, onEdit,
}: {
  roles: RoleItem[];
  canManage: boolean;
  onCreate: () => void;
  onEdit: (r: RoleItem) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState<RoleItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function duplicate(r: RoleItem) {
    try {
      await duplicateRole(r.id);
      toast.success('Rolle dupliziert.');
      router.refresh();
    } catch {
      toast.error('Rolle konnte nicht dupliziert werden.');
    }
  }

  function requestDelete(r: RoleItem) {
    if (r.userCount > 0) {
      toast.error(`„${r.name}" ist ${r.userCount === 1 ? 'einem Mitglied' : `${r.userCount} Mitgliedern`} zugewiesen. Entfernen Sie die Rolle zuerst von allen Mitgliedern.`);
      return;
    }
    setDeleteTarget(r);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRole(deleteTarget.id);
      toast.success('Rolle gelöscht.');
      setDeleteTarget(null);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'ROLE_IN_USE') {
        toast.error('Diese Rolle ist noch Mitgliedern zugewiesen und kann nicht gelöscht werden.');
      } else {
        toast.error('Rolle konnte nicht gelöscht werden.');
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <SectionLabel count={roles.length}>Benutzerdefinierte Rollen</SectionLabel>
        {canManage && (
          <Button size="sm" icon={<Plus size={14} />} onClick={onCreate}>Rolle erstellen</Button>
        )}
      </div>

      {roles.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px dashed #E4E3DF', borderRadius: 16,
          padding: '40px 24px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 12, textAlign: 'center',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 15, background: 'rgba(var(--accent-rgb),.1)',
            color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={22} />
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: '#0A0A0A' }}>Noch keine Rollen</div>
          <span style={{ fontSize: 13, color: '#909090', maxWidth: 360, lineHeight: 1.5 }}>
            Erstellen Sie benutzerdefinierte Rollen mit fein abgestimmten Berechtigungen und weisen Sie sie Ihren Team-Mitgliedern zu.
          </span>
          {canManage && (
            <div style={{ marginTop: 4 }}>
              <Button icon={<Plus size={14} />} onClick={onCreate}>Erste Rolle erstellen</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="roles-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14,
        }}>
          {roles.map((r) => (
            <RoleCard
              key={r.id}
              role={r}
              canManage={canManage}
              onEdit={onEdit}
              onDuplicate={duplicate}
              onDelete={requestDelete}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Rolle löschen"
        message={`Die Rolle „${deleteTarget?.name}" wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Löschen"
        danger
        loading={deleting}
      />
    </div>
  );
}
