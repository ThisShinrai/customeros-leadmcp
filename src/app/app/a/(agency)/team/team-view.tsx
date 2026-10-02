'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crown, MoreVertical, Mail, UserPlus, Shield, UserCog,
  UserX, UserCheck, Trash2, Send, Users,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import {
  Drawer, ConfirmDialog, Button, Field, Input, Select,
  DropdownMenu, useToast, TimeAgo, BentoCard, type DropdownItem,
} from '@/components/ui';
import { getInitials } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/permissions';
import {
  inviteMember, changeRole, setMemberStatus, removeMember, resendInvite,
} from './actions';
import {
  RolesSection, RoleEditorDrawer, AssignRolesDrawer, AssignedRoleChip,
} from './roles-view';
import type { RoleItem } from './roles-queries';
import type { TeamData, TeamMember } from './queries';

const ease = 'cubic-bezier(.16,1,.3,1) .22s';

/* ─── section label ─────────────────────────────────────────────── */

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

/* ─── role chip ─────────────────────────────────────────────────── */

function RoleChip({ role, roleLabel }: { role: TeamMember['role']; roleLabel: string }) {
  const isOwner = role === 'owner';
  return (
    <span style={{
      borderRadius: 100,
      border: isOwner ? '1px solid #0A0A0A' : '1px solid #E4E3DF',
      fontSize: 10, fontWeight: 600, padding: '3px 10px',
      color: isOwner ? '#fff' : '#505050',
      background: isOwner ? '#0A0A0A' : '#fff',
      display: 'inline-flex', alignItems: 'center', gap: 4,
      lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {isOwner && <Crown size={10} />}
      {roleLabel}
    </span>
  );
}

/* ─── pending chip ──────────────────────────────────────────────── */

function PendingChip() {
  return (
    <span style={{
      borderRadius: 100, border: '1.5px dashed #C4C4C0',
      fontSize: 10, fontWeight: 600, padding: '3px 10px',
      color: '#909090', background: '#fff',
      display: 'inline-flex', alignItems: 'center',
      lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      Eingeladen
    </span>
  );
}

/* ─── inactive chip ─────────────────────────────────────────────── */

function InactiveChip() {
  return (
    <span style={{
      borderRadius: 100, border: '1px solid #E4E3DF',
      fontSize: 10, fontWeight: 600, padding: '3px 10px',
      color: '#909090', background: '#F4F3F0',
      display: 'inline-flex', alignItems: 'center',
      lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      Deaktiviert
    </span>
  );
}

/* ─── kebab trigger ─────────────────────────────────────────────── */

function Kebab({ active }: { active: boolean }) {
  const [hover, setHover] = useState(false);
  const on = hover || active;
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Optionen"
      style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: on ? '#0A0A0A' : 'transparent',
        border: on ? '1px solid #0A0A0A' : '1px solid transparent',
        color: on ? '#fff' : '#909090',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        transition: `background ${ease}, color ${ease}, border-color ${ease}`,
      }}
    >
      <MoreVertical size={14} />
    </span>
  );
}

/* ─── member row ────────────────────────────────────────────────── */

function MemberRow({
  member, canManage, canManageRoles, isSelf, assignedRoleNames,
  onChangeRole, onRemove, onToggleStatus, onAssignRoles,
}: {
  member: TeamMember;
  canManage: boolean;
  canManageRoles: boolean;
  isSelf: boolean;
  assignedRoleNames: string[];
  onChangeRole: (m: TeamMember) => void;
  onRemove: (m: TeamMember) => void;
  onToggleStatus: (m: TeamMember) => void;
  onAssignRoles: (m: TeamMember) => void;
}) {
  const [hover, setHover] = useState(false);
  const isOwner = member.role === 'owner';
  const inactive = member.status === 'inactive';

  const items: DropdownItem[] = [];
  if (!isOwner) {
    items.push({ label: 'Rolle ändern', icon: <UserCog size={15} />, onClick: () => onChangeRole(member) });
    if (canManageRoles) {
      items.push({ label: 'Rollen zuweisen', icon: <Shield size={15} />, onClick: () => onAssignRoles(member) });
    }
    items.push({
      label: inactive ? 'Aktivieren' : 'Deaktivieren',
      icon: inactive ? <UserCheck size={15} /> : <UserX size={15} />,
      onClick: () => onToggleStatus(member),
    });
    if (!isSelf) {
      items.push({ label: 'Entfernen', icon: <Trash2 size={15} />, danger: true, onClick: () => onRemove(member) });
    }
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 14px',
        padding: '13px 16px', borderRadius: 14,
        background: hover ? '#F7F6F3' : 'transparent',
        transition: `background ${ease}`,
        cursor: 'default',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 46, height: 46, borderRadius: 13, flexShrink: 0,
        background: inactive ? '#C4C4C0' : '#0A0A0A', color: '#fff',
        fontSize: 13.5, fontWeight: 700, letterSpacing: '.04em',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: hover && !inactive ? '0 0 0 3px rgba(var(--accent-rgb),.16)' : '0 0 0 0 transparent',
        transition: `box-shadow ${ease}`,
      }}>
        {getInitials(member.name)}
      </div>

      {/* Name + email */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: '1 1 140px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 14.5, fontWeight: 700, letterSpacing: '-.2px',
            color: inactive ? '#909090' : '#0A0A0A',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {member.name}
          </span>
          {isSelf && (
            <span style={{ fontSize: 10, fontWeight: 600, color: '#909090' }}>(Sie)</span>
          )}
        </div>
        <span style={{
          fontSize: 12, color: '#909090', lineHeight: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {member.email}
        </span>
      </div>

      {/* Right cluster — wraps to its own line on narrow screens */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
        {!isOwner && assignedRoleNames.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {assignedRoleNames.slice(0, 2).map((n) => (
              <AssignedRoleChip key={n} name={n} />
            ))}
            {assignedRoleNames.length > 2 && (
              <span style={{
                borderRadius: 100, border: '1px solid #E4E3DF', background: '#F4F3F0',
                fontSize: 10, fontWeight: 600, padding: '3px 8px', color: '#909090',
                lineHeight: 1, whiteSpace: 'nowrap',
              }}>
                +{assignedRoleNames.length - 2}
              </span>
            )}
          </div>
        )}
        {inactive && <InactiveChip />}
        <RoleChip role={member.role} roleLabel={member.roleLabel} />
        {canManage && items.length > 0 ? (
          <DropdownMenu trigger={<Kebab active={false} />} items={items} />
        ) : (
          <div style={{ width: 28, height: 28, flexShrink: 0 }} />
        )}
      </div>
    </div>
  );
}

/* ─── invite row ────────────────────────────────────────────────── */

function InviteRow({
  invite, canManage, onResend, onRemove,
}: {
  invite: TeamMember;
  canManage: boolean;
  onResend: (m: TeamMember) => void;
  onRemove: (m: TeamMember) => void;
}) {
  const [hover, setHover] = useState(false);

  const items: DropdownItem[] = [
    { label: 'Erneut senden', icon: <Send size={15} />, onClick: () => onResend(invite) },
    { label: 'Entfernen', icon: <Trash2 size={15} />, danger: true, onClick: () => onRemove(invite) },
  ];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 14px',
        padding: '13px 16px', borderRadius: 14,
        background: hover ? '#F7F6F3' : 'transparent',
        transition: `background ${ease}`,
        cursor: 'default',
      }}
    >
      {/* Mail avatar */}
      <div style={{
        width: 46, height: 46, borderRadius: 13, flexShrink: 0,
        background: '#F0EFEC', color: '#909090',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Mail size={17} />
      </div>

      {/* Email + meta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 140px' }}>
        <span style={{
          fontSize: 14, fontWeight: 600, color: '#505050',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {invite.email}
        </span>
        <span style={{ fontSize: 12, color: '#909090', lineHeight: 1 }}>
          {invite.name} · {invite.roleLabel}
          {invite.createdAt ? <> · eingeladen <TimeAgo value={invite.createdAt} /></> : ''}
        </span>
      </div>

      {/* Right cluster — wraps on narrow screens */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
        <PendingChip />
        {canManage ? (
          <DropdownMenu trigger={<Kebab active={false} />} items={items} />
        ) : (
          <div style={{ width: 28, height: 28, flexShrink: 0 }} />
        )}
      </div>
    </div>
  );
}

/* ─── section card ──────────────────────────────────────────────── */

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <BentoCard interactive={false} padding={8} style={{ overflow: 'hidden' }}>
      {children}
    </BentoCard>
  );
}

/* ─── empty card ────────────────────────────────────────────────── */

function EmptyCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px dashed #E4E3DF', borderRadius: 14,
      padding: '28px 24px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 10, textAlign: 'center',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 11, background: '#F4F3F0',
        color: '#909090', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 13, color: '#909090', maxWidth: 320, lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

/* ─── invite modal ──────────────────────────────────────────────── */

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');

  function reset() {
    setName(''); setEmail(''); setRole('member');
  }

  function close() {
    if (loading) return;
    reset();
    onClose();
  }

  async function submit() {
    if (!name.trim()) { toast.error('Bitte geben Sie einen Namen ein.'); return; }
    if (!email.trim()) { toast.error('Bitte geben Sie eine E-Mail-Adresse ein.'); return; }
    setLoading(true);
    try {
      await inviteMember({ name, email, role });
      toast.success('Einladung gesendet.');
      reset();
      onClose();
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'ALREADY_EXISTS') toast.error('Diese Person ist bereits im Team.');
      else if (msg.includes('IS_CLIENT')) toast.error('Diese E-Mail ist bereits als Kunde angelegt und kann nicht ins Team eingeladen werden.');
      else toast.error('Einladung konnte nicht gesendet werden.');
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Mitglied einladen"
      subtitle="Senden Sie eine Einladung per Magic Link."
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading} icon={<UserPlus size={14} />}>Einladung senden</Button>
        </>
      }
    >
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Sophie Müller" autoFocus />
      </Field>
      <Field label="E-Mail">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@agentur.de" />
      </Field>
      <Field label="Rolle" hint="Projektleiter haben Zugriff auf alle Bereiche außer Abrechnung. Mitarbeiter sehen nur Projekte, an denen sie beteiligt sind.">
        <Select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')}>
          <option value="admin">{ROLE_LABELS.admin}</option>
          <option value="member">{ROLE_LABELS.member}</option>
        </Select>
      </Field>
    </Drawer>
  );
}

/* ─── role modal ────────────────────────────────────────────────── */

function RoleModal({
  member, onClose,
}: {
  member: TeamMember | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'admin' | 'member'>(member?.role === 'admin' ? 'admin' : 'member');

  // Keep local select in sync when a different member opens the modal.
  const open = member !== null;
  const memberKey = member?.id ?? '';
  const [lastKey, setLastKey] = useState(memberKey);
  if (memberKey !== lastKey) {
    setLastKey(memberKey);
    setRole(member?.role === 'admin' ? 'admin' : 'member');
  }

  async function submit() {
    if (!member) return;
    setLoading(true);
    try {
      await changeRole(member.id, role);
      toast.success('Rolle aktualisiert.');
      onClose();
      router.refresh();
    } catch {
      toast.error('Rolle konnte nicht geändert werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => { if (!loading) onClose(); }}
      title="Rolle ändern"
      subtitle={member ? member.name : undefined}
      width={440}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading} icon={<Shield size={14} />}>Speichern</Button>
        </>
      }
    >
      <Field label="Rolle">
        <Select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')}>
          <option value="admin">{ROLE_LABELS.admin}</option>
          <option value="member">{ROLE_LABELS.member}</option>
        </Select>
      </Field>
    </Drawer>
  );
}

/* ─── view ──────────────────────────────────────────────────────── */

/* ─── tab switch (Mitglieder / Rollen) ──────────────────────────── */

function TabSwitch({
  tab, onChange, memberCount, roleCount,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  memberCount: number;
  roleCount: number;
}) {
  const tabs: { key: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'members', label: 'Mitglieder', count: memberCount, icon: <Users size={14} /> },
    { key: 'roles', label: 'Rollen', count: roleCount, icon: <Shield size={14} /> },
  ];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, padding: 3,
      background: '#F4F3F0', borderRadius: 100, border: '1px solid #E4E3DF',
    }}>
      {tabs.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 13px', borderRadius: 100, border: 'none', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
              background: active ? '#0A0A0A' : 'transparent',
              color: active ? '#fff' : '#505050',
              transition: 'background .2s cubic-bezier(.16,1,.3,1), color .2s cubic-bezier(.16,1,.3,1)',
            }}
          >
            {t.icon}
            {t.label}
            <span style={{
              fontSize: 10, fontWeight: 700, lineHeight: 1.6, padding: '0 6px', borderRadius: 100,
              background: active ? 'rgba(255,255,255,.16)' : '#E4E3DF',
              color: active ? '#fff' : '#909090',
            }}>
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type Tab = 'members' | 'roles';

interface Props {
  data: TeamData;
  roles: RoleItem[];
  userRoleMap: Record<string, string[]>;
  canManage: boolean;
  canManageRoles: boolean;
  currentUserId: string;
}

export function TeamView({ data, roles, userRoleMap, canManage, canManageRoles, currentUserId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('members');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState(false);

  // Role editor (create = null target + editorOpen true).
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorRole, setEditorRole] = useState<RoleItem | null>(null);
  // Assign-roles target member.
  const [assignTarget, setAssignTarget] = useState<TeamMember | null>(null);

  const roleNameById = new Map(roles.map((r) => [r.id, r.name]));
  function assignedNames(memberId: string): string[] {
    return (userRoleMap[memberId] ?? [])
      .map((id) => roleNameById.get(id))
      .filter((n): n is string => Boolean(n));
  }

  function openCreateRole() { setEditorRole(null); setEditorOpen(true); }
  function openEditRole(r: RoleItem) { setEditorRole(r); setEditorOpen(true); }

  async function toggleStatus(m: TeamMember) {
    const next = m.status === 'inactive' ? 'active' : 'inactive';
    try {
      await setMemberStatus(m.id, next);
      toast.success(next === 'inactive' ? 'Mitglied deaktiviert.' : 'Mitglied aktiviert.');
      router.refresh();
    } catch {
      toast.error('Status konnte nicht geändert werden.');
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeMember(removeTarget.id);
      toast.success('Mitglied entfernt.');
      setRemoveTarget(null);
      router.refresh();
    } catch {
      toast.error('Mitglied konnte nicht entfernt werden.');
    } finally {
      setRemoving(false);
    }
  }

  async function resend(m: TeamMember) {
    try {
      await resendInvite(m.id);
      toast.success('Einladung erneut gesendet.');
      router.refresh();
    } catch {
      toast.error('Einladung konnte nicht gesendet werden.');
    }
  }

  const inviteButton = canManage ? (
    <Button size="sm" icon={<UserPlus size={14} />} onClick={() => setInviteOpen(true)} title="Mitglied einladen">
      <span className="cos-desktop-only">Mitglied einladen</span>
    </Button>
  ) : undefined;

  const memberCount = data.members.length;
  const showRolesTab = canManageRoles;
  const onRolesTab = showRolesTab && tab === 'roles';

  const topbarActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {showRolesTab && (
        <div className="cos-desktop-only" style={{ display: 'flex', alignItems: 'center' }}>
          <TabSwitch tab={tab} onChange={setTab} memberCount={memberCount} roleCount={roles.length} />
        </div>
      )}
      {/* Invite button only on the Mitglieder view */}
      {!onRolesTab && inviteButton}
    </div>
  );

  const subtitle = onRolesTab
    ? `${roles.length} Rolle${roles.length === 1 ? '' : 'n'}`
    : `${memberCount} Mitglied${memberCount === 1 ? '' : 'er'}`;

  return (
    <>
      <Topbar title="Team" subtitle={subtitle} actions={topbarActions} />

      <div style={{
        padding: '20px 24px 36px',
        display: 'flex', flexDirection: 'column', gap: 22,
      }}>
        {/* Mobile: tab switch lives in-content (topbar is too narrow) */}
        {showRolesTab && (
          <div className="cos-mobile-only" style={{ alignSelf: 'flex-start' }}>
            <TabSwitch tab={tab} onChange={setTab} memberCount={memberCount} roleCount={roles.length} />
          </div>
        )}
        {onRolesTab ? (
          /* ─── Rollen ───────────────────────────────────────────── */
          <RolesSection
            roles={roles}
            canManage={canManageRoles}
            onCreate={openCreateRole}
            onEdit={openEditRole}
          />
        ) : (
          <>
            {/* Team-Mitglieder */}
            <div>
              <SectionLabel count={data.members.length}>Team-Mitglieder</SectionLabel>
              {data.members.length === 0 ? (
                <EmptyCard icon={<UserPlus size={16} />} text="Noch keine Team-Mitglieder. Laden Sie Ihre Kolleginnen und Kollegen ein." />
              ) : (
                <SectionCard>
                  {data.members.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      canManage={canManage}
                      canManageRoles={canManageRoles}
                      isSelf={m.id === currentUserId}
                      assignedRoleNames={assignedNames(m.id)}
                      onChangeRole={setRoleTarget}
                      onRemove={setRemoveTarget}
                      onToggleStatus={toggleStatus}
                      onAssignRoles={setAssignTarget}
                    />
                  ))}
                </SectionCard>
              )}
            </div>

            {/* Ausstehende Einladungen */}
            {(data.invites.length > 0 || canManage) && (
              <div>
                <SectionLabel count={data.invites.length}>Ausstehende Einladungen</SectionLabel>
                {data.invites.length === 0 ? (
                  <EmptyCard icon={<Mail size={16} />} text="Keine ausstehenden Einladungen." />
                ) : (
                  <SectionCard>
                    {data.invites.map((m) => (
                      <InviteRow
                        key={m.id}
                        invite={m}
                        canManage={canManage}
                        onResend={resend}
                        onRemove={setRemoveTarget}
                      />
                    ))}
                  </SectionCard>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <RoleModal member={roleTarget} onClose={() => setRoleTarget(null)} />

      {/* Custom-role editor (create + edit) */}
      <RoleEditorDrawer
        open={editorOpen}
        role={editorRole}
        onClose={() => setEditorOpen(false)}
      />

      {/* Assign custom roles to a member */}
      <AssignRolesDrawer
        member={assignTarget}
        roles={roles}
        assignedRoleIds={assignTarget ? (userRoleMap[assignTarget.id] ?? []) : []}
        onClose={() => setAssignTarget(null)}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => { if (!removing) setRemoveTarget(null); }}
        onConfirm={confirmRemove}
        title={removeTarget?.status === 'invited' ? 'Einladung entfernen' : 'Mitglied entfernen'}
        message={
          removeTarget?.status === 'invited'
            ? `Die Einladung an ${removeTarget?.email} wird zurückgezogen.`
            : `${removeTarget?.name} wird aus dem Team entfernt und verliert den Zugang. Diese Aktion kann nicht rückgängig gemacht werden.`
        }
        confirmLabel="Entfernen"
        danger
        loading={removing}
      />
    </>
  );
}
