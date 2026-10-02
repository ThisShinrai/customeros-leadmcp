'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Camera, Mail, Building2, Bell, BellOff } from 'lucide-react';
import { Button, Field, Input, Label, useToast, Spinner } from '@/components/ui';
import { getInitials } from '@/lib/utils';
import { updateClientProfile, uploadClientAvatar } from '@/app/app/p/(portal)/[slug]/profile-actions';
import { updateClientEmailFrequency } from '@/app/app/p/(portal)/[slug]/notification-actions';
import { PushOptIn } from '@/components/push-opt-in';

const FRAME_COLORS = ['#0A0A0A', '#FF6B00', '#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#DB2777', '#0891B2'];

type Freq = 'sofort' | 'nie';

interface Props {
  name: string;
  email: string;
  company: string | null;
  avatarUrl: string | null;
  avatarFrameColor: string | null;
  emailFrequency: Freq;
}

export function PortalProfileForm({ name: initialName, email, company, avatarUrl, avatarFrameColor, emailFrequency }: Props) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [frame, setFrame] = useState(avatarFrameColor && FRAME_COLORS.includes(avatarFrameColor) ? avatarFrameColor : '#0A0A0A');
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [freq, setFreq] = useState<Freq>(emailFrequency);
  const [savingFreq, setSavingFreq] = useState(false);

  async function chooseFreq(next: Freq) {
    if (next === freq || savingFreq) return;
    const prev = freq;
    setFreq(next); // optimistic
    setSavingFreq(true);
    try {
      await updateClientEmailFrequency(next);
      toast.success(next === 'sofort' ? 'E-Mail-Benachrichtigungen aktiviert.' : 'E-Mail-Benachrichtigungen ausgeschaltet.');
      router.refresh();
    } catch {
      setFreq(prev); // roll back on failure
      toast.error('Einstellung konnte nicht gespeichert werden.');
    }
    setSavingFreq(false);
  }

  async function save() {
    if (!name.trim()) { toast.error('Bitte geben Sie einen Anzeigenamen ein.'); return; }
    setSaving(true);
    try {
      await updateClientProfile({ name: name.trim(), avatarFrameColor: frame });
      toast.success('Profil gespeichert.');
      router.refresh();
    } catch {
      toast.error('Profil konnte nicht gespeichert werden.');
    }
    setSaving(false);
  }

  async function onAvatarPick(file: File | null) {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.set('avatar', file);
      await uploadClientAvatar(fd);
      // Optimistic local preview from the same file.
      const reader = new FileReader();
      reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
      reader.readAsDataURL(file);
      toast.success('Profilbild aktualisiert.');
      router.refresh();
    } catch (e) {
      const msg = String((e as Error).message);
      toast.error(msg.includes('TOO_LARGE') ? 'Bild zu groß (max. 256 KB).' : msg.includes('NOT_IMAGE') ? 'Bitte eine Bilddatei wählen.' : 'Upload fehlgeschlagen.');
    }
    setUploadingAvatar(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Avatar */}
      <div style={{ border: '1px solid #E4E3DF', borderRadius: 18, padding: '22px 24px', background: '#fff', display: 'flex', alignItems: 'center', gap: 20 }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{ position: 'relative', width: 76, height: 76, borderRadius: '50%', background: frame, color: '#fff', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', cursor: 'pointer', border: 'none', padding: 0 }}
          title="Profilbild ändern"
        >
          {preview ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(name)}
          <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: uploadingAvatar ? 1 : 0, transition: 'opacity .14s' }} className="avatar-overlay">
            {uploadingAvatar ? <Spinner size={18} color="#fff" /> : <Camera size={18} />}
          </span>
        </button>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0A0A0A', marginBottom: 4 }}>Profilbild</div>
          <div style={{ fontSize: 12.5, color: '#909090', lineHeight: 1.5, marginBottom: 10 }}>Quadratisches Bild, max. 256 KB.</div>
          <Button size="sm" variant="secondary" icon={<Camera size={14} />} onClick={() => fileRef.current?.click()} loading={uploadingAvatar}>Bild wählen</Button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onAvatarPick(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      {/* Details */}
      <div style={{ border: '1px solid #E4E3DF', borderRadius: 18, padding: '22px 24px', background: '#fff' }}>
        <Field label="Anzeigename">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ihr Name" maxLength={80} />
        </Field>

        <Field label="Avatar-Rahmenfarbe">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {FRAME_COLORS.map((c) => {
              const active = c === frame;
              return (
                <button
                  key={c}
                  onClick={() => setFrame(c)}
                  title={c}
                  style={{ width: 34, height: 34, borderRadius: '50%', background: c, border: active ? '2px solid #0A0A0A' : '2px solid transparent', outline: active ? '2px solid #fff' : 'none', outlineOffset: -4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'transform .14s var(--ease)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {active && <Check size={15} color="#fff" />}
                </button>
              );
            })}
          </div>
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <Button onClick={save} loading={saving} icon={<Check size={15} />}>Änderungen speichern</Button>
        </div>
      </div>

      {/* E-Mail-Benachrichtigungen */}
      <div style={{ border: '1px solid #E4E3DF', borderRadius: 18, padding: '22px 24px', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(var(--accent-rgb),.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bell size={16} />
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-0.2px', lineHeight: 1.1 }}>E-Mail-Benachrichtigungen</div>
            <div style={{ fontSize: 12.5, color: '#909090', marginTop: 2 }}>Bei neuer Aktivität in Ihren Projekten.</div>
          </div>
        </div>
        <div role="radiogroup" aria-label="E-Mail-Benachrichtigungen" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FreqOption
            active={freq === 'sofort'}
            icon={<Bell size={17} />}
            title="Sofort"
            hint="Bei neuer Aktivität sofort eine E-Mail."
            onSelect={() => chooseFreq('sofort')}
            disabled={savingFreq}
          />
          <FreqOption
            active={freq === 'nie'}
            icon={<BellOff size={17} />}
            title="Aus"
            hint="Keine Benachrichtigungs-E-Mails."
            onSelect={() => chooseFreq('nie')}
            disabled={savingFreq}
          />
        </div>
        <PushOptIn />
      </div>

      {/* Read-only */}
      <div style={{ border: '1px solid #E4E3DF', borderRadius: 18, padding: '22px 24px', background: '#fff' }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.12em', color: '#909090', marginBottom: 16 }}>Kontodaten</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ReadOnlyRow icon={<Mail size={15} />} label="E-Mail" value={email} />
          <ReadOnlyRow icon={<Building2 size={15} />} label="Firma" value={company || '—'} />
        </div>
        <div style={{ fontSize: 11.5, color: '#b0b0b0', marginTop: 16, lineHeight: 1.5 }}>
          E-Mail und Firma werden von Ihrer Agentur verwaltet. Bei Änderungen wenden Sie sich bitte an Ihre Ansprechpartner.
        </div>
      </div>

      <style>{`
        .avatar-overlay { opacity: 0; }
        button:hover > .avatar-overlay { opacity: 1; }
      `}</style>
    </div>
  );
}

function FreqOption({
  active, icon, title, hint, onSelect, disabled,
}: {
  active: boolean; icon: React.ReactNode; title: string; hint: string;
  onSelect: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left',
        padding: '14px 15px', borderRadius: 14, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
        border: active ? '2px solid var(--accent)' : '1.5px solid #E4E3DF',
        background: active ? 'rgba(var(--accent-rgb),.05)' : '#fff',
        boxShadow: active ? '0 0 0 4px rgba(var(--accent-rgb),.08)' : 'none',
        opacity: disabled ? 0.6 : 1,
        transition: 'background .18s var(--ease), border-color .18s var(--ease), box-shadow .18s var(--ease)',
      }}
    >
      <span style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--accent)' : '#F4F3F0', color: active ? '#fff' : '#909090',
        transition: 'background .18s var(--ease), color .18s var(--ease)',
      }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-0.2px' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#909090', marginTop: 2, lineHeight: 1.45 }}>{hint}</div>
      </div>
      <span style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: active ? 'none' : '2px solid #D4D3CF',
        background: active ? 'var(--accent)' : '#fff',
        transition: 'background .18s var(--ease), border-color .18s var(--ease)',
      }}>
        {active && <Check size={13} strokeWidth={3} color="#fff" />}
      </span>
    </button>
  );
}

function ReadOnlyRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EDECE9', color: '#505050', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <Label style={{ marginBottom: 2 }}>{label}</Label>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1B18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      </div>
    </div>
  );
}
