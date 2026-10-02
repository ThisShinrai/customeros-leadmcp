'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check, Globe, Shield, User, Palette, Upload, ImageIcon, CreditCard,
  Sparkles, RotateCcw, PanelTop, ArrowRight, SlidersHorizontal, ChevronDown, History, FileText,
  KeyRound, Copy, Trash2, Plus, Terminal, Webhook, Eye, EyeOff, Link2, BookOpen,
  LifeBuoy, Mail, Clock, MessageSquarePlus, Bell, BellOff,
} from 'lucide-react';
import { Button, Field, Input, Textarea, BentoCard, Drawer, ConfirmDialog, useToast } from '@/components/ui';
import { AdFreeCard } from '@/components/promo';
import { SupportInfoCard, DEPARTMENT_LABELS } from '@/components/support';
import { NavToggle } from '@/components/layout/nav-toggle';
import { PushOptIn } from '@/components/push-opt-in';
import { getInitials, relativeTime } from '@/lib/utils';
import {
  updateAgencyProfile, updateWhiteLabel, uploadLogo, verifyCustomDomain,
  updateUserProfile, uploadAvatar,
} from './actions';
import { updateEmailFrequency } from './notification-actions';
import { createApiKey, revokeApiKey, type ApiKeyListItem } from './api-actions';
import { createWebhook, updateWebhook, deleteWebhook, type WebhookListItem } from './webhook-actions';
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_KEYS } from '@/lib/webhook-events';
import { startCheckout } from './billing-actions';
import { PLAN_LIMITS, PLAN_ORDER, type Plan } from '@/lib/plans';
import type { AgencySettings, UserSettings, AuditLogEntry } from './queries';

/* ─── types ─────────────────────────────────────────────────────── */
type Section = 'profil' | 'whitelabel' | 'mein-profil' | 'benachrichtigungen' | 'abrechnung' | 'sicherheit' | 'api' | 'support';

/* ─── constants ─────────────────────────────────────────────────── */
const ease = 'cubic-bezier(.16,1,.3,1) .18s';
const EASE = 'cubic-bezier(.16,1,.3,1)';

const ACCENT_SWATCHES = ['#0A0A0A', '#FF6B00', '#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#DB2777', '#0891B2'];
const FRAME_SWATCHES = ['#0A0A0A', '#FF6B00', '#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#DB2777', '#0891B2'];
const LOGIN_BG_SWATCHES = ['#0A0A0A', '#111827', '#1E1B4B', '#0F172A', '#F4F3F0', '#FFFFFF', '#FFF7ED', '#F0F9FF'];
const TEXT_SWATCHES = ['#FFFFFF', '#0A0A0A', '#F4F3F0', '#FFF7ED'];
const DEFAULT_LOGIN_BG = '#0A0A0A';
const DEFAULT_ACCENT_TEXT = '#FFFFFF';
const MAX_IMAGE_BYTES = 256 * 1024;

const NAV_GROUPS: { label: string; items: { id: Section; label: string; icon: React.ElementType }[] }[] = [
  {
    label: 'Agentur',
    items: [
      { id: 'profil', label: 'Agentur-Profil', icon: User },
      { id: 'whitelabel', label: 'White-Label', icon: Palette },
      { id: 'abrechnung', label: 'Abrechnung', icon: CreditCard },
    ],
  },
  {
    label: 'Konto',
    items: [
      { id: 'mein-profil', label: 'Mein Profil', icon: User },
      { id: 'benachrichtigungen', label: 'Benachrichtigungen', icon: Bell },
      { id: 'sicherheit', label: 'Sicherheit', icon: Shield },
    ],
  },
  {
    label: 'Entwickler',
    items: [
      { id: 'api', label: 'API & Webhooks', icon: Webhook },
    ],
  },
  {
    label: 'Hilfe',
    items: [
      { id: 'support', label: 'Support', icon: LifeBuoy },
    ],
  },
];

const SECTION_TITLES: Record<Section, string> = {
  'profil': 'Agentur-Profil',
  'whitelabel': 'White-Label',
  'mein-profil': 'Mein Profil',
  'benachrichtigungen': 'Benachrichtigungen',
  'abrechnung': 'Abrechnung',
  'sicherheit': 'Sicherheit',
  'api': 'API & Webhooks',
  'support': 'Support',
};

/* ─── shared primitives ─────────────────────────────────────────── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <BentoCard interactive={false} padding="32px 34px" style={{ borderRadius: 24, ...style }}>
      {children}
    </BentoCard>
  );
}

/** Bold dark hero header — the dashboard's energy on every section. */
function HeroHead({
  eyebrow, title, subtitle, icon, accentText = '#fff', accentBg = 'var(--accent)', children,
}: {
  eyebrow: string; title: string; subtitle: string; icon: React.ReactNode;
  accentText?: string; accentBg?: string; children?: React.ReactNode;
}) {
  return (
    <BentoCard dark padding={0} style={{ position: 'relative', overflow: 'hidden', marginBottom: 18 }}>
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),.5), transparent 64%)', top: -120, right: -80, filter: 'blur(38px)', opacity: .6, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, padding: '30px 34px', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
        <span style={{ width: 56, height: 56, borderRadius: 16, background: accentBg, color: accentText, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 10px 30px rgba(var(--accent-rgb),.4)' }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.16em', color: 'var(--accent)', marginBottom: 8 }}>{eyebrow}</div>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-1.2px', lineHeight: 1.02, margin: 0 }}>{title}</h2>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', lineHeight: 1.5, margin: '9px 0 0', maxWidth: 540 }}>{subtitle}</p>
        </div>
        {children && <div style={{ flexShrink: 0 }}>{children}</div>}
      </div>
    </BentoCard>
  );
}

/** Sub-heading inside a card to break up dense forms. */
function Subhead({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(var(--accent-rgb),.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.3px', lineHeight: 1.1 }}>{title}</div>
        {hint && <div style={{ fontSize: 12, color: '#909090', marginTop: 2 }}>{hint}</div>}
      </div>
    </div>
  );
}

function SwatchRow({
  swatches, value, onChange,
}: { swatches: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {swatches.map((color) => {
        const active = value.toUpperCase() === color.toUpperCase();
        const isLight = isLightColor(color);
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            title={color}
            style={{
              width: 32, height: 32, borderRadius: 9, background: color,
              border: isLight ? '1px solid #E4E3DF' : '2px solid transparent',
              boxShadow: active ? '0 0 0 2px #fff, 0 0 0 4px #0A0A0A' : 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: `transform ${ease}, box-shadow ${ease}`, flexShrink: 0,
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.transform = 'scale(1.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {active && <Check size={14} strokeWidth={3} color={isLight ? '#0A0A0A' : '#fff'} style={{ filter: isLight ? 'none' : 'drop-shadow(0 1px 1px rgba(0,0,0,.35))' }} />}
          </button>
        );
      })}
    </div>
  );
}

/** Full color control: preset swatches + native picker + hex readout (+ optional reset). */
function ColorControl({
  swatches, value, onChange, canEdit, onReset, resetLabel,
}: {
  swatches: string[]; value: string; onChange: (c: string) => void; canEdit: boolean;
  onReset?: () => void; resetLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <SwatchRow swatches={swatches} value={value} onChange={(c) => canEdit && onChange(c)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14, borderLeft: '1px solid #E4E3DF' }}>
        <label style={{ position: 'relative', width: 32, height: 32, borderRadius: 9, overflow: 'hidden', cursor: canEdit ? 'pointer' : 'default', border: '1px solid #E4E3DF', display: 'block', flexShrink: 0 }} title="Eigene Farbe">
          <span style={{ position: 'absolute', inset: 0, background: value }} />
          <input type="color" value={normalizeHex(value)} disabled={!canEdit} onChange={(e) => onChange(e.target.value.toUpperCase())} style={{ position: 'absolute', inset: -4, width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', opacity: 0, cursor: canEdit ? 'pointer' : 'default' }} />
        </label>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#505050', fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em' }}>{value.toUpperCase()}</span>
      </div>
      {onReset && canEdit && (
        <button
          type="button"
          onClick={onReset}
          title={resetLabel || 'Zurücksetzen'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#909090', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 8, transition: `color ${ease}` }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#0A0A0A'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#909090'; }}
        >
          <RotateCcw size={12} /> {resetLabel || 'Standard'}
        </button>
      )}
    </div>
  );
}

/* ─── section: Agentur-Profil ────────────────────────────────────── */
function ProfilSection({ agency, canEdit }: { agency: AgencySettings; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logo, setLogo] = useState<string | null>(agency.logo);
  const [form, setForm] = useState({
    name: agency.name,
    contactEmail: agency.contactEmail ?? '',
    phone: agency.phone ?? '',
    website: agency.website ?? '',
    address: agency.address ?? '',
    taxId: agency.taxId ?? '',
    // E-Rechnung (EN 16931)
    iban: agency.iban ?? '',
    bic: agency.bic ?? '',
    street: agency.street ?? '',
    zip: agency.zip ?? '',
    city: agency.city ?? '',
    country: agency.country ?? 'DE',
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.name.trim()) { toast.error('Agenturname ist erforderlich.'); return; }
    setSaving(true);
    try {
      await updateAgencyProfile(form);
      toast.success('Profil gespeichert.');
      router.refresh();
    } catch (e) {
      toast.error(String((e as Error).message).includes('FORBIDDEN') ? 'Keine Berechtigung.' : 'Speichern fehlgeschlagen.');
    }
    setSaving(false);
  }

  async function onLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) { toast.error('Logo ist zu groß (max. 256 KB).'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await uploadLogo(fd);
      setLogo(URL.createObjectURL(file));
      toast.success('Logo aktualisiert.');
      router.refresh();
    } catch (err) {
      toast.error(String((err as Error).message).includes('TOO_LARGE') ? 'Logo ist zu groß (max. 256 KB).' : 'Upload fehlgeschlagen.');
    }
    setUploading(false);
  }

  return (
    <div>
      <HeroHead
        eyebrow="Agentur"
        title="Agentur-Profil"
        subtitle="Grundlegende Informationen zu Ihrer Agentur — erscheinen auf Rechnungen und im Kunden-Portal."
        icon={<User size={24} />}
      />
      <Card>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #EDECE9' }}>
          <div style={{ width: 76, height: 76, borderRadius: 18, background: '#F4F3F0', border: '1px solid #E4E3DF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {logo
              ? <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <ImageIcon size={26} color="#B0AFA9" />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.3px', marginBottom: 3 }}>Agentur-Logo</div>
            <div style={{ fontSize: 12.5, color: '#909090', marginBottom: 12 }}>PNG oder JPG, max. 256 KB.</div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onLogoPick} style={{ display: 'none' }} />
            <Button size="sm" variant="secondary" icon={<Upload size={13} />} loading={uploading} disabled={!canEdit} onClick={() => fileRef.current?.click()}>Logo hochladen</Button>
          </div>
        </div>

        <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Field label="Agenturname" style={{ gridColumn: '1 / -1' }}>
            <Input value={form.name} onChange={set('name')} placeholder="Kreativagentur Müller & Co." disabled={!canEdit} />
          </Field>
          <Field label="Kontakt-E-Mail">
            <Input type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="hallo@agentur.de" disabled={!canEdit} />
          </Field>
          <Field label="Telefon">
            <Input type="tel" value={form.phone} onChange={set('phone')} placeholder="+49 89 123456" disabled={!canEdit} />
          </Field>
          <Field label="Website" style={{ gridColumn: '1 / -1' }}>
            <Input type="url" value={form.website} onChange={set('website')} placeholder="https://meineagentur.de" disabled={!canEdit} />
          </Field>
          <Field label="Adresse" style={{ gridColumn: '1 / -1' }}>
            <Textarea value={form.address} onChange={set('address')} rows={2} style={{ minHeight: 64 }} placeholder="Musterstraße 1, 80331 München" disabled={!canEdit} />
          </Field>
          <Field label="USt-ID / Steuernummer" style={{ gridColumn: '1 / -1' }}>
            <Input value={form.taxId} onChange={set('taxId')} placeholder="DE123456789" disabled={!canEdit} />
          </Field>
        </div>

        {/* ── Rechnungsdaten (E-Rechnung / EN 16931) ── */}
        <div style={{ marginTop: 26, paddingTop: 26, borderTop: '1px solid #EDECE9' }}>
          <Subhead
            icon={<FileText size={16} />}
            title="Rechnungsdaten (E-Rechnung)"
            hint="Pflichtangaben für gesetzeskonforme E-Rechnungen (EN 16931) — Zahlungsdaten und ladungsfähige Anschrift."
          />
          <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <Field label="IBAN">
              <Input value={form.iban} onChange={set('iban')} placeholder="DE89 3704 0044 0532 0130 00" disabled={!canEdit} />
            </Field>
            <Field label="BIC">
              <Input value={form.bic} onChange={set('bic')} placeholder="COBADEFFXXX" disabled={!canEdit} />
            </Field>
            <Field label="Straße & Hausnummer" style={{ gridColumn: '1 / -1' }}>
              <Input value={form.street} onChange={set('street')} placeholder="Musterstraße 1" disabled={!canEdit} />
            </Field>
            <Field label="PLZ">
              <Input value={form.zip} onChange={set('zip')} placeholder="80331" disabled={!canEdit} />
            </Field>
            <Field label="Stadt">
              <Input value={form.city} onChange={set('city')} placeholder="München" disabled={!canEdit} />
            </Field>
            <Field label="Land" hint="ISO-Ländercode, z. B. DE." style={{ gridColumn: '1 / -1' }}>
              <Input value={form.country} onChange={set('country')} placeholder="DE" maxLength={2} disabled={!canEdit} />
            </Field>
          </div>
        </div>

        {canEdit && (
          <div style={{ marginTop: 12, paddingTop: 22, borderTop: '1px solid #EDECE9' }}>
            <Button loading={saving} onClick={save}>Änderungen speichern</Button>
          </div>
        )}
        {!canEdit && <ReadOnlyHint />}
      </Card>
    </div>
  );
}

/* ─── section: White-Label ───────────────────────────────────────── */
function WhiteLabelSection({ agency, canEdit }: { agency: AgencySettings; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [accent, setAccent] = useState(agency.accentColor || '#0A0A0A');
  const [loginBg, setLoginBg] = useState(agency.loginBgColor || DEFAULT_LOGIN_BG);
  const [accentText, setAccentText] = useState(agency.portalAccentText || DEFAULT_ACCENT_TEXT);
  const [domain, setDomain] = useState(agency.customDomain ?? '');
  const portalUrl = `c.epssys.de/app/p/${agency.slug}`;
  const loginIsLight = isLightColor(loginBg);
  const [verifying, setVerifying] = useState(false);
  const [domainStatus, setDomainStatus] = useState<{ reachable: boolean; routed: boolean } | null>(null);
  const cleanHost = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0];
  const cnameName = cleanHost.split('.').length > 2 ? cleanHost.split('.')[0] : '@';

  async function save() {
    if (!/^#[0-9a-fA-F]{6}$/.test(accent)) { toast.error('Bitte eine gültige Akzentfarbe wählen (z. B. #FF6B00).'); return; }
    if (!/^#[0-9a-fA-F]{6}$/.test(loginBg)) { toast.error('Bitte eine gültige Login-Hintergrundfarbe wählen.'); return; }
    if (!/^#[0-9a-fA-F]{6}$/.test(accentText)) { toast.error('Bitte eine gültige Textfarbe wählen.'); return; }
    setSaving(true);
    try {
      await updateWhiteLabel({
        accentColor: accent,
        loginBgColor: loginBg,
        portalAccentText: accentText,
        customDomain: domain,
      });
      toast.success('White-Label gespeichert — ist jetzt live.');
      // Refresh so the agency layout re-injects --accent.
      router.refresh();
    } catch (e) {
      toast.error(String((e as Error).message).includes('FORBIDDEN') ? 'Keine Berechtigung.' : 'Speichern fehlgeschlagen.');
    }
    setSaving(false);
  }

  async function checkDomain() {
    if (!domain.trim()) return;
    setVerifying(true); setDomainStatus(null);
    try {
      const r = await verifyCustomDomain(domain);
      setDomainStatus(r);
      if (r.routed) toast.success('Domain ist verbunden und leitet auf Ihr Portal.');
      else if (r.reachable) toast.error('Domain erreichbar, aber leitet noch nicht zu epssys — DNS prüfen.');
      else toast.error('Domain nicht erreichbar — DNS-Eintrag fehlt oder noch nicht aktiv.');
    } catch { toast.error('Prüfung fehlgeschlagen.'); }
    setVerifying(false);
  }

  return (
    <div>
      <HeroHead
        eyebrow="Marke"
        title="White-Label Portal"
        subtitle="Gestalten Sie das Kunden-Portal als Ihre eigene Marke. Akzentfarbe, Login-Hintergrund und Button-Text — alles sofort live."
        icon={<Palette size={24} />}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 100, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.85)', fontSize: 12.5, fontWeight: 600 }}>
          <Sparkles size={13} /> Live-Vorschau aktiv
        </span>
      </HeroHead>

      {/* ── Werbefrei add-on ── */}
      <div style={{ marginBottom: 18 }}>
        <AdFreeCard enabled={agency.teamAdsDisabled} />
      </div>

      {/* ── Live branded-login preview ── */}
      <Card style={{ marginBottom: 18, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 28px 18px', borderBottom: '1px solid #EDECE9', flexWrap: 'wrap' }}>
          <Subhead icon={<PanelTop size={16} />} title="Live-Vorschau: Kunden-Login" hint="So sehen Ihre Kunden den Anmelde-Bildschirm." />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#909090', fontVariantNumeric: 'tabular-nums' }}>{portalUrl}</span>
        </div>

        {/* The mock login screen — rendered on loginBg with accent button */}
        <div style={{ position: 'relative', overflow: 'hidden', background: loginBg, padding: '52px 28px', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: `background .3s ${EASE}` }}>
          {/* accent ambient glow */}
          <div style={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', background: `radial-gradient(circle, ${hexToRgba(accent, loginIsLight ? 0.28 : 0.5)}, transparent 64%)`, top: -160, left: '50%', transform: 'translateX(-50%)', filter: 'blur(46px)', pointerEvents: 'none' }} />
          {/* mock auth card */}
          <div style={{
            position: 'relative', zIndex: 1, width: 320, maxWidth: '100%',
            background: loginIsLight ? '#fff' : 'rgba(255,255,255,.04)',
            border: loginIsLight ? '1px solid #E4E3DF' : '1px solid rgba(255,255,255,.1)',
            borderRadius: 22, padding: '30px 28px',
            boxShadow: loginIsLight ? '0 24px 60px rgba(0,0,0,.12)' : '0 24px 60px rgba(0,0,0,.5)',
            backdropFilter: 'blur(8px)',
          }}>
            {/* logo / brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 22 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: agency.logo ? 'transparent' : accent, color: accentText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, overflow: 'hidden', flexShrink: 0 }}>
                {agency.logo
                  ? <img src={agency.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : getInitials(agency.name)}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.4px', color: loginIsLight ? '#0A0A0A' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agency.name}</span>
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.6px', color: loginIsLight ? '#0A0A0A' : '#fff', marginBottom: 6 }}>Willkommen zurück</div>
            <div style={{ fontSize: 12.5, color: loginIsLight ? '#909090' : 'rgba(255,255,255,.5)', marginBottom: 20, lineHeight: 1.5 }}>Melden Sie sich an, um Ihre Projekte zu sehen.</div>
            {/* mock input */}
            <div style={{ height: 42, borderRadius: 11, background: loginIsLight ? '#F4F3F0' : 'rgba(255,255,255,.06)', border: loginIsLight ? '1px solid #E4E3DF' : '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', padding: '0 13px', fontSize: 12.5, color: loginIsLight ? '#b8b6b0' : 'rgba(255,255,255,.4)', marginBottom: 12 }}>
              name@firma.de
            </div>
            {/* the accent button with accentText color */}
            <div style={{ height: 44, borderRadius: 100, background: accent, color: accentText, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 14, fontWeight: 700, boxShadow: `0 10px 26px ${hexToRgba(accent, 0.42)}` }}>
              Magic-Link senden <ArrowRight size={15} />
            </div>
          </div>
        </div>
      </Card>

      {/* ── Color controls ── */}
      <Card>
        <Subhead icon={<SlidersHorizontal size={16} />} title="Markenfarben" hint="Voreinstellungen wählen oder eigene Werte setzen." />

        {/* Accent color — drives --accent live */}
        <Field label="Akzentfarbe" hint="Buttons, Links und Hervorhebungen — gilt sofort im gesamten Portal.">
          <ColorControl swatches={ACCENT_SWATCHES} value={accent} onChange={setAccent} canEdit={canEdit} />
        </Field>

        {/* Extended white-label: login background + accent text */}
        <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
          <Field label="Login-Hintergrund" hint="Hintergrund des Anmelde-Bildschirms im Kunden-Portal.">
            <ColorControl
              swatches={LOGIN_BG_SWATCHES}
              value={loginBg}
              onChange={setLoginBg}
              canEdit={canEdit}
              onReset={() => setLoginBg(DEFAULT_LOGIN_BG)}
              resetLabel="Standard"
            />
          </Field>
          <Field label="Text auf Akzentfarbe" hint="Schriftfarbe auf farbigen Buttons (Standard: Weiß).">
            <ColorControl
              swatches={TEXT_SWATCHES}
              value={accentText}
              onChange={setAccentText}
              canEdit={canEdit}
              onReset={() => setAccentText(DEFAULT_ACCENT_TEXT)}
              resetLabel="Weiß"
            />
          </Field>
        </div>

        <div style={{ height: 1, background: '#EDECE9', margin: '6px 0 22px' }} />

        <Subhead icon={<Globe size={16} />} title="Domain & Adresse" hint="Wo Ihre Kunden das Portal erreichen." />
        <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          {/* Portal URL (read-only) */}
          <Field label="Portal-URL" hint="Diese Adresse erhalten Ihre Kunden im Einladungs-Link.">
            <div style={{ display: 'flex', alignItems: 'center', height: 44, padding: '0 14px', borderRadius: 10, border: '1.5px solid #E4E3DF', background: '#FAFAF9' }}>
              <Globe size={15} color="#909090" style={{ flexShrink: 0, marginRight: 9 }} />
              <span style={{ fontSize: 14, color: '#505050', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{portalUrl}</span>
            </div>
          </Field>

          {/* Custom domain */}
          <Field label="Eigene Domain (optional)" hint="Z. B. portal.meineagentur.de — DNS-Einrichtung erforderlich.">
            <Input value={domain} onChange={(e) => { setDomain(e.target.value); setDomainStatus(null); }} placeholder="portal.meineagentur.de" disabled={!canEdit} />
          </Field>
        </div>

        {/* DNS setup panel — shown once a custom domain is entered */}
        {cleanHost.includes('.') && (
          <div style={{ marginTop: 14, borderRadius: 14, border: '1px solid #E4E3DF', background: '#FAFAF9', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, flexWrap: 'wrap' }}>
              <Globe size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0A0A0A' }}>DNS-Einrichtung</span>
              {domainStatus && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 100,
                  background: domainStatus.routed ? 'rgba(34,197,94,.12)' : 'rgba(234,179,8,.14)',
                  color: domainStatus.routed ? '#15803D' : '#A16207',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: domainStatus.routed ? '#22C55E' : '#EAB308' }} />
                  {domainStatus.routed ? 'Verbunden' : domainStatus.reachable ? 'Erreichbar, nicht verbunden' : 'Nicht erreichbar'}
                </span>
              )}
            </div>
            <p style={{ fontSize: 12.5, color: '#707070', lineHeight: 1.6, margin: '0 0 12px' }}>
              Legen Sie bei Ihrem Domain-Anbieter einen <strong>CNAME</strong>-Eintrag an, der <strong style={{ color: '#0A0A0A' }}>{cleanHost}</strong> auf unseren Host zeigt:
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #EDECE9', borderRadius: 10, padding: '11px 14px', flexWrap: 'wrap' }}>
              <code style={{ fontSize: 12.5, color: '#909090' }}>CNAME</code>
              <code style={{ fontSize: 12.5, fontWeight: 700, color: '#0A0A0A' }}>{cnameName}</code>
              <span style={{ color: '#C8C6C0' }}>→</span>
              <code style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>c.epssys.de</code>
              <button type="button" onClick={() => { navigator.clipboard?.writeText('c.epssys.de'); toast.success('Ziel kopiert.'); }}
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#505050', padding: '5px 10px', borderRadius: 8, border: '1px solid #E4E3DF', background: '#FAFAF9', cursor: 'pointer' }}>
                <Copy size={12} /> Kopieren
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <Button variant="secondary" size="sm" loading={verifying} onClick={checkDomain} disabled={!canEdit}>Verbindung prüfen</Button>
              <span style={{ fontSize: 11.5, color: '#909090', lineHeight: 1.5, flex: 1, minWidth: 180 }}>Die Domain muss einmalig für epssys aktiviert werden (Cloudflare Custom Hostname) — danach ist sie sofort live.</span>
            </div>
          </div>
        )}

        {canEdit
          ? <div style={{ marginTop: 12, paddingTop: 22, borderTop: '1px solid #EDECE9' }}><Button loading={saving} onClick={save}>White-Label speichern</Button></div>
          : <ReadOnlyHint />}
      </Card>
    </div>
  );
}

/* ─── section: Mein Profil (user) ────────────────────────────────── */
function MeinProfilSection({ user }: { user: UserSettings }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(user.avatarUrl);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? '');
  const [frame, setFrame] = useState(user.avatarFrameColor || '#0A0A0A');

  async function save() {
    if (!name.trim()) { toast.error('Anzeigename ist erforderlich.'); return; }
    setSaving(true);
    try {
      await updateUserProfile({ name, bio, avatarFrameColor: frame });
      toast.success('Profil gespeichert.');
      router.refresh();
    } catch {
      toast.error('Speichern fehlgeschlagen.');
    }
    setSaving(false);
  }

  async function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) { toast.error('Bild ist zu groß (max. 256 KB).'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      await uploadAvatar(fd);
      setAvatar(URL.createObjectURL(file));
      toast.success('Avatar aktualisiert.');
      router.refresh();
    } catch (err) {
      toast.error(String((err as Error).message).includes('TOO_LARGE') ? 'Bild ist zu groß (max. 256 KB).' : 'Upload fehlgeschlagen.');
    }
    setUploading(false);
  }

  return (
    <div>
      <HeroHead
        eyebrow="Konto"
        title="Mein Profil"
        subtitle="Ihre persönlichen Angaben — Name und Bio sehen Ihre Kunden im Chat-Widget."
        icon={frame ? <span style={{ fontSize: 18, fontWeight: 800 }}>{getInitials(name)}</span> : <User size={24} />}
        accentBg={frame}
        accentText="#fff"
      />
      <Card>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #EDECE9' }}>
          <div style={{ width: 76, height: 76, borderRadius: 20, background: frame, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
            {avatar ? <img src={avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(name)}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.3px', marginBottom: 3 }}>Profilbild</div>
            <div style={{ fontSize: 12.5, color: '#909090', marginBottom: 12 }}>PNG oder JPG, max. 256 KB.</div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatarPick} style={{ display: 'none' }} />
            <Button size="sm" variant="secondary" icon={<Upload size={13} />} loading={uploading} onClick={() => fileRef.current?.click()}>Avatar hochladen</Button>
          </div>
        </div>

        <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Field label="Anzeigename">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Max Mustermann" />
          </Field>
          <Field label="E-Mail" hint="Ihre Login-Adresse — nicht änderbar.">
            <Input value={user.email} disabled readOnly />
          </Field>
          <Field label="Bio" hint="Sichtbar für Kunden im Chat." style={{ gridColumn: '1 / -1' }}>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Kurze Vorstellung, z. B. Ihre Rolle in der Agentur." />
          </Field>
          <Field label="Avatar-Rahmenfarbe" hint="Akzentrahmen Ihres Profilbilds im Chat." style={{ gridColumn: '1 / -1' }}>
            <ColorControl swatches={FRAME_SWATCHES} value={frame} onChange={setFrame} canEdit />
          </Field>
        </div>

        <div style={{ marginTop: 12, paddingTop: 22, borderTop: '1px solid #EDECE9' }}>
          <Button loading={saving} onClick={save}>Profil speichern</Button>
        </div>
      </Card>
    </div>
  );
}

/* ─── section: Benachrichtigungen (email prefs) ──────────────────── */

type Freq = 'sofort' | 'nie';

/** One selectable option row in the e-mail-frequency segmented choice. */
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
        padding: '15px 16px', borderRadius: 15, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
        border: active ? '2px solid var(--accent)' : '1.5px solid #E4E3DF',
        background: active ? 'rgba(var(--accent-rgb),.05)' : '#fff',
        boxShadow: active ? '0 0 0 4px rgba(var(--accent-rgb),.08)' : 'none',
        opacity: disabled ? 0.6 : 1,
        transition: `background ${ease}, border-color ${ease}, box-shadow ${ease}`,
      }}
      onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = '#FAFAF9'; }}
      onMouseLeave={(e) => { if (!active && !disabled) e.currentTarget.style.background = '#fff'; }}
    >
      <span style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--accent)' : '#F4F3F0', color: active ? '#fff' : '#909090',
        transition: `background ${ease}, color ${ease}`,
      }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-0.2px' }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#909090', marginTop: 2, lineHeight: 1.45 }}>{hint}</div>
      </div>
      {/* Radio dot */}
      <span style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: active ? 'none' : '2px solid #D4D3CF',
        background: active ? 'var(--accent)' : '#fff',
        transition: `background ${ease}, border-color ${ease}`,
      }}>
        {active && <Check size={13} strokeWidth={3} color="#fff" />}
      </span>
    </button>
  );
}

function BenachrichtigungenSection({ user }: { user: UserSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [freq, setFreq] = useState<Freq>(user.emailFrequency);
  const [saving, setSaving] = useState(false);

  async function choose(next: Freq) {
    if (next === freq || saving) return;
    const prev = freq;
    setFreq(next); // optimistic
    setSaving(true);
    try {
      await updateEmailFrequency(next);
      toast.success(next === 'sofort' ? 'E-Mail-Benachrichtigungen aktiviert.' : 'E-Mail-Benachrichtigungen ausgeschaltet.');
      router.refresh();
    } catch {
      setFreq(prev); // roll back on failure
      toast.error('Speichern fehlgeschlagen.');
    }
    setSaving(false);
  }

  return (
    <div>
      <HeroHead
        eyebrow="Konto"
        title="Benachrichtigungen"
        subtitle="Legen Sie fest, ob Sie bei neuer Aktivität in Ihren Projekten per E-Mail informiert werden möchten."
        icon={<Bell size={24} />}
      />
      <Card>
        <Subhead
          icon={<Mail size={16} />}
          title="E-Mail-Benachrichtigungen"
          hint="Gilt für Aktivitäts-E-Mails aus Ihrem Portal — z. B. neue Nachrichten und Freigaben."
        />
        <div role="radiogroup" aria-label="E-Mail-Benachrichtigungen" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FreqOption
            active={freq === 'sofort'}
            icon={<Bell size={18} />}
            title="Sofort"
            hint="Bei neuer Aktivität sofort eine E-Mail."
            onSelect={() => choose('sofort')}
            disabled={saving}
          />
          <FreqOption
            active={freq === 'nie'}
            icon={<BellOff size={18} />}
            title="Aus"
            hint="Keine Benachrichtigungs-E-Mails."
            onSelect={() => choose('nie')}
            disabled={saving}
          />
        </div>
        <PushOptIn />
      </Card>
    </div>
  );
}

/* ─── section: placeholder ───────────────────────────────────────── */
function ReadOnlyHint() {
  return (
    <div style={{ marginTop: 18, fontSize: 12.5, color: '#909090', display: 'flex', alignItems: 'center', gap: 7 }}>
      <Shield size={13} /> Sie haben keine Berechtigung, diese Einstellungen zu ändern.
    </div>
  );
}

function ComingSoon({ eyebrow, title, description, icon }: { eyebrow: string; title: string; description: string; icon: React.ReactNode }) {
  return (
    <div>
      <HeroHead eyebrow={eyebrow} title={title} subtitle={description} icon={icon} />
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '48px 24px', borderRadius: 18, background: '#FAFAF9', border: '1.5px dashed #E4E3DF', textAlign: 'center' }}>
          <span style={{ width: 52, height: 52, borderRadius: 15, background: '#fff', border: '1px solid #E4E3DF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B0AFA9', flexShrink: 0 }}>
            {icon}
          </span>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#505050' }}>Bald verfügbar</div>
          <div style={{ fontSize: 13, color: '#909090', maxWidth: 320, lineHeight: 1.5 }}>Wir arbeiten daran, diese Funktion für Sie freizuschalten.</div>
        </div>
      </Card>
    </div>
  );
}

/* ─── section: Support → Direkter Kontakt ────────────────────────── */
const SUPPORT_EMAIL = 'contact@epssys.de';
const SUPPORT_HOURS = 'Mo–Fr, 10–19 Uhr';

/** Clean contact card under the SupportInfoCard: copyable e-mail, hours,
 *  a primary "Support kontaktieren" action and the topics you can ask about. */
function DirekterKontaktCard() {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      toast.success('E-Mail-Adresse kopiert.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopieren fehlgeschlagen — bitte manuell markieren.');
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <Card>
        <Subhead
          icon={<MessageSquarePlus size={16} />}
          title="Direkter Kontakt"
          hint="Schreiben Sie uns direkt — wir melden uns werktags innerhalb der Support-Zeiten."
        />

        {/* E-Mail — copyable row (mirrors the copy pattern in ApiKeysSection) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 13, border: '1px solid #E4E3DF', background: '#FAFAF9' }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(var(--accent-rgb),.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: '#909090', marginBottom: 2 }}>Support-E-Mail</div>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              style={{ fontSize: 14.5, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-0.2px', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
          <Button size="sm" variant={copied ? 'secondary' : 'ghost'} icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={copyEmail} style={{ flexShrink: 0 }}>
            {copied ? 'Kopiert' : 'Kopieren'}
          </Button>
        </div>

        {/* Support hours */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, fontSize: 13, color: '#505050' }}>
          <Clock size={15} style={{ color: '#909090', flexShrink: 0 }} />
          <span>Support-Zeiten: <strong style={{ color: '#0A0A0A', fontWeight: 700 }}>{SUPPORT_HOURS}</strong></span>
        </div>

        {/* Primary action — opens the global contact drawer */}
        <div style={{ marginTop: 18 }}>
          <Button icon={<MessageSquarePlus size={15} />} onClick={() => window.dispatchEvent(new Event('cos:open-support'))}>
            Support kontaktieren
          </Button>
        </div>

        {/* What you can reach us about — department chips */}
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid #EDECE9' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#909090', marginBottom: 10 }}>Sie erreichen uns zu:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {Object.values(DEPARTMENT_LABELS).map((label) => (
              <span
                key={label}
                style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 100, background: '#F4F3F0', color: '#505050', border: '1px solid #E4E3DF' }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─── Audit-Log ──────────────────────────────────────────────────── */

/** Dotted action keys → German labels for the audit feed. */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  'client.invited': 'Kunde eingeladen',
  'team.invited': 'Teammitglied eingeladen',
  'team.role_changed': 'Rolle geändert',
  'team.roles_assigned': 'Rollen zugewiesen',
  'invoice.sent': 'Rechnung freigegeben',
  'invoice.paid': 'Rechnung als bezahlt markiert',
  'file.released': 'Datei freigegeben',
  'file.unreleased': 'Datei-Freigabe entzogen',
  'settings.whitelabel_updated': 'White-Label aktualisiert',
};

function auditLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

function AuditLogSection({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <div style={{ marginTop: 18 }}>
      <Card>
        <Subhead
          icon={<History size={16} />}
          title="Audit-Log"
          hint="Sicherheitsrelevante Aktionen Ihres Teams — neueste zuerst."
        />
        {entries.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '40px 24px', borderRadius: 18, background: '#FAFAF9', border: '1.5px dashed #E4E3DF', textAlign: 'center' }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: '#fff', border: '1px solid #E4E3DF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B0AFA9', flexShrink: 0 }}>
              <History size={20} />
            </span>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#505050' }}>Noch keine Einträge</div>
            <div style={{ fontSize: 12.5, color: '#909090', maxWidth: 300, lineHeight: 1.5 }}>Sobald Ihr Team Einladungen verschickt, Rechnungen freigibt oder Einstellungen ändert, erscheint das hier.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {entries.map((e) => (
              <div
                key={e.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 13, padding: '11px 12px', borderRadius: 13,
                  transition: `background ${ease}`,
                }}
                onMouseEnter={(ev) => { ev.currentTarget.style.background = '#F4F3F0'; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'rgba(var(--accent-rgb),.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <History size={15} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A0A0A', letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {auditLabel(e.action)}
                  </div>
                  <div style={{ fontSize: 12, color: '#909090', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.actorName ?? 'System'}
                  </div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#B0AFA9', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {relativeTime(e.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Docs primitives (shared by the API + Webhook drawers) ──────── */

/** Dark, monospace code block — matches the curl block in ApiKeysSection. */
function CodeBlock({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <pre style={{
      margin: 0, background: '#0A0A0A', borderRadius: 14, padding: '15px 17px', overflowX: 'auto',
      fontSize: 12.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.6,
      color: 'rgba(255,255,255,.92)', whiteSpace: 'pre', tabSize: 2, ...style,
    }}>
      {children}
    </pre>
  );
}

/** Inline `code` token in the light, washed style used throughout the file. */
function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      fontSize: 12, fontWeight: 600, color: '#0A0A0A', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      background: '#F4F3F0', border: '1px solid #E4E3DF', borderRadius: 7, padding: '2px 7px', wordBreak: 'break-word',
    }}>
      {children}
    </code>
  );
}

/** Small section heading inside a docs drawer. */
function DocSection({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <section style={{ marginTop: first ? 0 : 26 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: 'var(--accent)', marginBottom: 11 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: '#505050', lineHeight: 1.65 }}>{children}</div>
    </section>
  );
}

/** Two-column key/value table (endpoints, events) with the file's borders. */
function DocTable({ rows }: { rows: { code: string; label: string }[] }) {
  return (
    <div style={{ border: '1px solid #EDECE9', borderRadius: 12, overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 13px', borderTop: i === 0 ? 'none' : '1px solid #EDECE9' }}>
          <code style={{ fontSize: 12, fontWeight: 700, color: '#0A0A0A', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>{r.code}</code>
          <span style={{ fontSize: 12.5, color: '#909090', textAlign: 'right', marginLeft: 'auto', lineHeight: 1.4 }}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── API-Schlüssel ──────────────────────────────────────────────── */

const API_ENDPOINTS = ['/api/v1/projects', '/api/v1/clients', '/api/v1/invoices', '/api/v1/tasks'];

const API_DOC_ENDPOINTS: { code: string; label: string }[] = [
  { code: 'GET /projects', label: '{ data: [...] } — alle Projekte' },
  { code: 'GET /clients', label: '{ data: [...] } — alle Kunden' },
  { code: 'GET /invoices', label: '{ data: [...] } — alle Rechnungen' },
  { code: 'GET /tasks', label: '{ data: [...] } — alle Aufgaben' },
];

/** Right-side reference drawer for the REST API. */
function ApiDocsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} side="right" width={520} title="API-Dokumentation" subtitle="Die epssys REST-API — Authentifizierung, Endpunkte und Beispiele.">
      <DocSection title="Base-URL" first>
        Alle Anfragen gehen an{' '}
        <InlineCode>https://c.epssys.de/api/v1</InlineCode>. Antworten sind immer JSON.
      </DocSection>

      <DocSection title="Authentifizierung">
        Sende deinen API-Schlüssel als Bearer-Token im{' '}
        <InlineCode>Authorization</InlineCode>-Header. Behandle ihn wie ein Passwort.
        <div style={{ marginTop: 12 }}>
          <CodeBlock>{`Authorization: Bearer eps_live_…`}</CodeBlock>
        </div>
      </DocSection>

      <DocSection title="Endpunkte">
        <DocTable rows={API_DOC_ENDPOINTS} />
      </DocSection>

      <DocSection title="Beispiel-Request">
        <CodeBlock>{`curl https://c.epssys.de/api/v1/projects \\
  -H "Authorization: Bearer eps_live_…"`}</CodeBlock>
      </DocSection>

      <DocSection title="Beispiel-Response">
        <CodeBlock>{`{
  "data": [
    { "id": "…", "name": "…", "status": "active" }
  ]
}`}</CodeBlock>
      </DocSection>

      <DocSection title="Fehler">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 15px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: '#DC2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800 }}>!</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0A0A0A' }}><InlineCode>401 Unauthorized</InlineCode></div>
            <div style={{ fontSize: 12.5, color: '#9a4a4a', marginTop: 4, lineHeight: 1.5 }}>Kein oder ungültiger API-Schlüssel. Prüfe den <InlineCode>Authorization</InlineCode>-Header und ob der Schlüssel noch aktiv ist.</div>
          </div>
        </div>
      </DocSection>
    </Drawer>
  );
}

/** Right-side reference drawer for outgoing webhooks. */
function WebhookDocsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} side="right" width={520} title="Webhook-Dokumentation" subtitle="Wie epssys deine Endpoints aufruft — Headers, Payload und Signatur-Prüfung.">
      <DocSection title="Funktionsweise" first>
        Sobald eines deiner abonnierten Events eintritt, sendet epssys einen{' '}
        <InlineCode>POST</InlineCode>-Request mit JSON-Body an deine konfigurierte URL.
      </DocSection>

      <DocSection title="Headers">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div><InlineCode>X-Epssys-Event</InlineCode> <span style={{ color: '#909090' }}>— der Event-Schlüssel, z. B. <InlineCode>invoice.sent</InlineCode></span></div>
          <div><InlineCode>X-Epssys-Signature</InlineCode> <span style={{ color: '#909090' }}>— HMAC-SHA256 des Bodies mit deinem Secret (Hex)</span></div>
          <div><InlineCode>Content-Type</InlineCode> <span style={{ color: '#909090' }}>— <InlineCode>application/json</InlineCode></span></div>
        </div>
      </DocSection>

      <DocSection title="Payload">
        <CodeBlock>{`{
  "event": "invoice.sent",
  "data": { … },
  "timestamp": 1717000000000
}`}</CodeBlock>
      </DocSection>

      <DocSection title="Events">
        <DocTable rows={WEBHOOK_EVENTS.map((e) => ({ code: e.key, label: e.label }))} />
      </DocSection>

      <DocSection title="Signatur verifizieren (Node.js)">
        Berechne den HMAC über den <strong>rohen</strong> Request-Body und vergleiche ihn mit dem Header.
        <div style={{ marginTop: 12 }}>
          <CodeBlock>{`import crypto from 'crypto';

const sig = crypto
  .createHmac('sha256', SECRET)
  .update(rawBody)
  .digest('hex');

if (sig !== req.headers['x-epssys-signature'])
  return res.status(401).end();`}</CodeBlock>
        </div>
      </DocSection>

      <DocSection title="Hinweis">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 15px', borderRadius: 12, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: '#D97706', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Sparkles size={13} /></span>
          <div style={{ fontSize: 12.5, color: '#92660c', lineHeight: 1.55 }}>
            Zustellung erfolgt nach <strong>Best-Effort</strong> mit einem Timeout von <strong>5&nbsp;Sekunden</strong>. Aktuell gibt es <strong>keine Retries</strong> — antworte zügig mit <InlineCode>2xx</InlineCode>.
          </div>
        </div>
      </DocSection>
    </Drawer>
  );
}

/* ─── Event picker (per-webhook event selection) ─────────────────── */

/** Checkbox list + "Alle Events" master toggle. `value`=['*'] means all. */
function EventPicker({
  value, onChange, idPrefix,
}: { value: string[]; onChange: (events: string[]) => void; idPrefix: string }) {
  const all = value.includes('*');
  const checkedSet = new Set(all ? WEBHOOK_EVENT_KEYS : value);

  function toggleAll() {
    onChange(all ? [] : ['*']);
  }
  function toggleOne(key: string) {
    // Materialise the current concrete selection, then flip the one key.
    const next = new Set(all ? WEBHOOK_EVENT_KEYS : value.filter((k) => k !== '*'));
    if (next.has(key)) next.delete(key); else next.add(key);
    if (next.size === WEBHOOK_EVENT_KEYS.length) { onChange(['*']); return; }
    onChange([...next]);
  }

  const rowBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 11,
    cursor: 'pointer', userSelect: 'none', transition: `background ${ease}`,
  };

  return (
    <div style={{ border: '1px solid #E4E3DF', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      {/* Master "Alle Events" toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={all}
        onClick={toggleAll}
        style={{ ...rowBase, width: '100%', textAlign: 'left', border: 'none', fontFamily: 'inherit', background: all ? 'rgba(var(--accent-rgb),.06)' : '#FAFAF9', borderBottom: '1px solid #EDECE9' }}
        onMouseEnter={(e) => { if (!all) e.currentTarget.style.background = '#F4F3F0'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = all ? 'rgba(var(--accent-rgb),.06)' : '#FAFAF9'; }}
      >
        <Checkbox checked={all} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-0.2px' }}>Alle Events</div>
          <div style={{ fontSize: 12, color: '#909090', marginTop: 1 }}>Bei jedem unterstützten Event benachrichtigen.</div>
        </div>
      </button>

      {/* Per-event rows */}
      <div style={{ padding: 5, display: 'flex', flexDirection: 'column', gap: 2, opacity: all ? 0.55 : 1, transition: `opacity ${ease}` }}>
        {WEBHOOK_EVENTS.map((ev) => {
          const checked = checkedSet.has(ev.key);
          return (
            <label
              key={ev.key}
              htmlFor={`${idPrefix}-${ev.key}`}
              style={rowBase}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F3F0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <input
                id={`${idPrefix}-${ev.key}`}
                type="checkbox"
                checked={checked}
                onChange={() => toggleOne(ev.key)}
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
              />
              <Checkbox checked={checked} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0A0A0A' }}>{ev.label}</div>
                <code style={{ fontSize: 11.5, fontWeight: 600, color: '#909090', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{ev.key}</code>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Square accent checkbox box (visual only — the real input drives state). */
function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span style={{
      width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: checked ? 'var(--accent)' : '#fff',
      border: checked ? '1.5px solid var(--accent)' : '1.5px solid #D4D3CF',
      transition: `background ${ease}, border-color ${ease}`,
    }}>
      {checked && <Check size={13} strokeWidth={3} color="#fff" />}
    </span>
  );
}

/** Read-only chips summarising a webhook's subscribed events. */
function EventChips({ events }: { events: string[] }) {
  if (events.includes('*')) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 100, background: 'rgba(var(--accent-rgb),.1)', color: 'var(--accent)' }}>
        <Sparkles size={11} /> Alle Events
      </span>
    );
  }
  const known = WEBHOOK_EVENTS.filter((e) => events.includes(e.key));
  if (known.length === 0) {
    return <span style={{ fontSize: 11.5, color: '#B0AFA9' }}>Keine Events</span>;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {known.map((e) => (
        <span key={e.key} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 100, background: '#F4F3F0', color: '#505050', border: '1px solid #E4E3DF' }}>
          {e.label}
        </span>
      ))}
    </span>
  );
}

/** One-time reveal box for a freshly created key — copy-once, never shown again. */
function NewKeyReveal({ value, onDone }: { value: string; onDone: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Schlüssel kopiert.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopieren fehlgeschlagen — bitte manuell markieren.');
    }
  }

  return (
    <div style={{
      marginBottom: 20, borderRadius: 16, overflow: 'hidden',
      border: '1.5px solid rgba(var(--accent-rgb),.45)',
      background: 'rgba(var(--accent-rgb),.05)',
      boxShadow: '0 0 0 4px rgba(var(--accent-rgb),.07)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px 11px', borderBottom: '1px solid rgba(var(--accent-rgb),.16)' }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.2px' }}>Neuer Schlüssel erstellt</div>
          <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 1 }}>Kopiere ihn jetzt — er wird nicht erneut angezeigt.</div>
        </div>
        <button
          type="button"
          onClick={onDone}
          style={{ fontSize: 12, fontWeight: 600, color: '#909090', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, flexShrink: 0, transition: `color ${ease}` }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#0A0A0A'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#909090'; }}
        >
          Fertig
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', flexWrap: 'wrap' }}>
        <code style={{
          flex: 1, minWidth: 200, fontSize: 13, fontWeight: 600, color: '#0A0A0A',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '.01em',
          background: '#fff', border: '1px solid #E4E3DF', borderRadius: 10, padding: '10px 13px',
          wordBreak: 'break-all', lineHeight: 1.4,
        }}>
          {value}
        </code>
        <Button size="sm" variant={copied ? 'secondary' : 'primary'} icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={copy}>
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      </div>
    </div>
  );
}

function ApiKeyRow({ item, onRevoke }: { item: ApiKeyListItem; onRevoke: (item: ApiKeyListItem) => void }) {
  const revoked = !!item.revokedAt;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 13, padding: '12px 13px', borderRadius: 13,
        opacity: revoked ? 0.62 : 1, transition: `background ${ease}`,
      }}
      onMouseEnter={(ev) => { if (!revoked) ev.currentTarget.style.background = '#F4F3F0'; }}
      onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: revoked ? '#F4F3F0' : 'rgba(var(--accent-rgb),.1)', color: revoked ? '#B0AFA9' : 'var(--accent)',
      }}>
        <KeyRound size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.name}
          </span>
          {revoked && (
            <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#DC2626', background: 'rgba(220,38,38,.1)', padding: '3px 8px', borderRadius: 100 }}>
              Widerrufen
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 12, color: '#909090', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 600, color: '#505050' }}>{item.prefix}••••••••</code>
          <span style={{ color: '#D4D3CF' }}>·</span>
          <span>Zuletzt genutzt: {item.lastUsedAt ? relativeTime(item.lastUsedAt) : '—'}</span>
        </div>
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#B0AFA9', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
      </span>
      {!revoked && (
        <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => onRevoke(item)} style={{ flexShrink: 0 }}>
          Widerrufen
        </Button>
      )}
    </div>
  );
}

function ApiKeysSection({ apiKeys }: { apiKeys: ApiKeyListItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [toRevoke, setToRevoke] = useState<ApiKeyListItem | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Bitte einen Namen für den Schlüssel angeben.'); return; }
    setCreating(true);
    try {
      const { key } = await createApiKey(trimmed);
      setNewKey(key);
      setName('');
      toast.success('Schlüssel erstellt.');
      router.refresh();
    } catch (e) {
      toast.error(String((e as Error).message).includes('FORBIDDEN') ? 'Keine Berechtigung.' : 'Schlüssel konnte nicht erstellt werden.');
    }
    setCreating(false);
  }

  async function confirmRevoke() {
    if (!toRevoke) return;
    setRevoking(true);
    try {
      await revokeApiKey(toRevoke.id);
      toast.success('Schlüssel widerrufen.');
      setToRevoke(null);
      router.refresh();
    } catch (e) {
      toast.error(String((e as Error).message).includes('FORBIDDEN') ? 'Keine Berechtigung.' : 'Widerrufen fehlgeschlagen.');
    }
    setRevoking(false);
  }

  const activeKeys = apiKeys.filter((k) => !k.revokedAt);
  const revokedKeys = apiKeys.filter((k) => k.revokedAt);
  const ordered = [...activeKeys, ...revokedKeys];

  return (
    <div style={{ marginTop: 18 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <Subhead
            icon={<KeyRound size={16} />}
            title="API-Schlüssel"
            hint="Zugriff auf die epssys REST-API. Schlüssel wie ein Passwort behandeln."
          />
          <Button size="sm" variant="secondary" icon={<BookOpen size={14} />} onClick={() => setDocsOpen(true)} style={{ flexShrink: 0 }}>
            Dokumentation
          </Button>
        </div>

        {/* One-time reveal of a freshly created key */}
        {newKey && <NewKeyReveal value={newKey} onDone={() => setNewKey(null)} />}

        {/* Create form — label above · input + button on one aligned row · hint below */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--faint)', marginBottom: 6 }}>Name</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
              placeholder="z. B. Produktiv-Backend"
              maxLength={60}
              style={{ flex: 1, minWidth: 0 }}
            />
            <Button icon={<Plus size={15} />} loading={creating} onClick={create} style={{ flexShrink: 0 }}>Schlüssel erstellen</Button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6 }}>Wofür wird der Schlüssel genutzt? Z. B. „Zapier-Integration“.</div>
        </div>

        {/* Existing keys */}
        {ordered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '36px 24px', borderRadius: 18, background: '#FAFAF9', border: '1.5px dashed #E4E3DF', textAlign: 'center' }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: '#fff', border: '1px solid #E4E3DF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B0AFA9', flexShrink: 0 }}>
              <KeyRound size={20} />
            </span>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#505050' }}>Noch keine Schlüssel</div>
            <div style={{ fontSize: 12.5, color: '#909090', maxWidth: 320, lineHeight: 1.5 }}>Erstellen Sie einen Schlüssel, um per REST-API auf Ihre Projekte, Kunden und Rechnungen zuzugreifen.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ordered.map((item) => (
              <ApiKeyRow key={item.id} item={item} onRevoke={setToRevoke} />
            ))}
          </div>
        )}

        {/* Usage hint with code sample + endpoint list */}
        <div style={{ marginTop: 22, paddingTop: 22, borderTop: '1px solid #EDECE9' }}>
          <Subhead icon={<Terminal size={16} />} title="So nutzt du die API" hint="Schlüssel als Bearer-Token im Authorization-Header senden." />
          <div style={{
            background: '#0A0A0A', borderRadius: 14, padding: '15px 17px', overflowX: 'auto',
            fontSize: 12.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.6, color: 'rgba(255,255,255,.92)',
          }}>
            <span style={{ color: 'rgba(255,255,255,.4)', userSelect: 'none' }}>$ </span>
            curl https://c.epssys.de/api/v1/projects \{'\n'}
            {'  '}-H <span style={{ color: 'var(--accent)' }}>&quot;Authorization: Bearer DEIN_KEY&quot;</span>
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#909090', marginRight: 2 }}>Endpunkte:</span>
            {API_ENDPOINTS.map((ep) => (
              <code key={ep} style={{
                fontSize: 12, fontWeight: 600, color: '#0A0A0A', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                background: '#F4F3F0', border: '1px solid #E4E3DF', borderRadius: 8, padding: '4px 9px',
              }}>
                {ep}
              </code>
            ))}
          </div>
        </div>
      </Card>

      {/* Revoke confirmation */}
      <ConfirmDialog
        open={!!toRevoke}
        onClose={() => setToRevoke(null)}
        onConfirm={confirmRevoke}
        title="Schlüssel widerrufen?"
        message={`Der Schlüssel „${toRevoke?.name ?? ''}“ wird sofort ungültig. Anwendungen, die ihn nutzen, verlieren den Zugriff. Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Widerrufen"
        danger
        loading={revoking}
      />

      {/* Right-side docs drawer */}
      <ApiDocsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} />
    </div>
  );
}

/* ─── Webhooks ───────────────────────────────────────────────────── */

/** One endpoint row: URL, event chips, Aktiv-toggle, secret reveal/copy, inline event editor, remove. */
function WebhookRow({ item, onDelete }: { item: WebhookListItem; onDelete: (item: WebhookListItem) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftEvents, setDraftEvents] = useState<string[]>(item.events);
  const [savingEvents, setSavingEvents] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  function openEditor() {
    setDraftEvents(item.events);
    setEditing(true);
  }

  async function saveEvents() {
    const events = draftEvents.includes('*') ? ['*'] : draftEvents;
    if (events.length === 0) { toast.error('Bitte mindestens ein Event wählen.'); return; }
    setSavingEvents(true);
    try {
      await updateWebhook(item.id, { events });
      toast.success('Events aktualisiert.');
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast.error(String((e as Error).message).includes('FORBIDDEN') ? 'Keine Berechtigung.' : 'Speichern fehlgeschlagen.');
    }
    setSavingEvents(false);
  }

  async function toggleActive() {
    setTogglingActive(true);
    try {
      await updateWebhook(item.id, { active: !item.active });
      toast.success(item.active ? 'Webhook deaktiviert.' : 'Webhook aktiviert.');
      router.refresh();
    } catch (e) {
      toast.error(String((e as Error).message).includes('FORBIDDEN') ? 'Keine Berechtigung.' : 'Aktualisieren fehlgeschlagen.');
    }
    setTogglingActive(false);
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(item.secret);
      setCopied(true);
      toast.success('Secret kopiert.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopieren fehlgeschlagen — bitte manuell markieren.');
    }
  }

  return (
    <div
      style={{
        padding: '12px 13px', borderRadius: 13,
        opacity: item.active ? 1 : 0.72,
        background: editing ? '#FAFAF9' : 'transparent',
        transition: `background ${ease}, opacity ${ease}`,
      }}
      onMouseEnter={(ev) => { if (!editing) ev.currentTarget.style.background = '#F4F3F0'; }}
      onMouseLeave={(ev) => { if (!editing) ev.currentTarget.style.background = 'transparent'; }}
    >
      {/* Top line: icon · url + secret · date · actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(var(--accent-rgb),.1)', color: 'var(--accent)',
        }}>
          <Webhook size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0A0A0A', letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.url}
            </span>
            {!item.active && (
              <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#909090', background: '#F4F3F0', padding: '3px 8px', borderRadius: 100 }}>
                Inaktiv
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3, minWidth: 0 }}>
            <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, fontWeight: 600, color: '#505050', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
              {revealed ? item.secret : 'whsec_••••••••••••••••'}
            </code>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              title={revealed ? 'Secret verbergen' : 'Secret anzeigen'}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 7, border: 'none', background: 'transparent', color: '#909090', cursor: 'pointer', flexShrink: 0, transition: `color ${ease}, background ${ease}` }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#0A0A0A'; e.currentTarget.style.background = '#EDECE9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#909090'; e.currentTarget.style.background = 'transparent'; }}
            >
              {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button
              type="button"
              onClick={copySecret}
              title="Secret kopieren"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 7, border: 'none', background: 'transparent', color: copied ? 'var(--accent)' : '#909090', cursor: 'pointer', flexShrink: 0, transition: `color ${ease}, background ${ease}` }}
              onMouseEnter={(e) => { if (!copied) { e.currentTarget.style.color = '#0A0A0A'; e.currentTarget.style.background = '#EDECE9'; } }}
              onMouseLeave={(e) => { if (!copied) { e.currentTarget.style.color = '#909090'; e.currentTarget.style.background = 'transparent'; } }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
        <span className="cos-desktop-only" style={{ fontSize: 11.5, fontWeight: 600, color: '#B0AFA9', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
        </span>
        {/* Aktiv/Inaktiv toggle */}
        <ActiveToggle active={item.active} loading={togglingActive} onToggle={toggleActive} />
        <Button size="sm" variant={editing ? 'secondary' : 'ghost'} icon={<SlidersHorizontal size={13} />} onClick={() => (editing ? setEditing(false) : openEditor())} style={{ flexShrink: 0 }}>
          Events
        </Button>
        <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => onDelete(item)} style={{ flexShrink: 0 }}>
          Entfernen
        </Button>
      </div>

      {/* Subscribed-events chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, paddingLeft: 49, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#B0AFA9', textTransform: 'uppercase', letterSpacing: '.08em' }}>Events</span>
        <EventChips events={item.events} />
      </div>

      {/* Inline event editor */}
      {editing && (
        <div style={{ marginTop: 13, marginLeft: 49, paddingTop: 14, borderTop: '1px dashed #E4E3DF', animation: `webhookEditorIn .3s ${EASE}` }}>
          <EventPicker value={draftEvents} onChange={setDraftEvents} idPrefix={`edit-${item.id}`} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 13 }}>
            <Button size="sm" loading={savingEvents} onClick={saveEvents}>Speichern</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Abbrechen</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact Aktiv/Inaktiv pill toggle for a webhook row. */
function ActiveToggle({ active, loading, onToggle }: { active: boolean; loading: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      title={active ? 'Webhook deaktivieren' : 'Webhook aktivieren'}
      aria-pressed={active}
      style={{
        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 11px', borderRadius: 100,
        border: active ? '1px solid rgba(var(--accent-rgb),.3)' : '1.5px solid #E4E3DF',
        background: active ? 'rgba(var(--accent-rgb),.1)' : '#fff',
        color: active ? 'var(--accent)' : '#909090',
        fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.6 : 1, transition: `background ${ease}, color ${ease}, border-color ${ease}`,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? 'var(--accent)' : '#C8C7C2', flexShrink: 0 }} />
      {active ? 'Aktiv' : 'Inaktiv'}
    </button>
  );
}

function WebhooksSection({ webhooks }: { webhooks: WebhookListItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['*']); // default: Alle Events
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<WebhookListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  async function create() {
    const trimmed = url.trim();
    if (!trimmed) { toast.error('Bitte eine URL angeben.'); return; }
    const payload = events.includes('*') ? ['*'] : events;
    if (payload.length === 0) { toast.error('Bitte mindestens ein Event wählen oder „Alle Events“ aktivieren.'); return; }
    setCreating(true);
    try {
      await createWebhook(trimmed, payload);
      setUrl('');
      setEvents(['*']);
      toast.success('Webhook hinzugefügt.');
      router.refresh();
    } catch (e) {
      const msg = String((e as Error).message);
      toast.error(msg.includes('FORBIDDEN') ? 'Keine Berechtigung.' : msg.includes('URL') ? 'Ungültige URL.' : 'Webhook konnte nicht hinzugefügt werden.');
    }
    setCreating(false);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteWebhook(toDelete.id);
      toast.success('Webhook entfernt.');
      setToDelete(null);
      router.refresh();
    } catch (e) {
      toast.error(String((e as Error).message).includes('FORBIDDEN') ? 'Keine Berechtigung.' : 'Entfernen fehlgeschlagen.');
    }
    setDeleting(false);
  }

  return (
    <div style={{ marginTop: 18 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <Subhead
            icon={<Webhook size={16} />}
            title="Webhooks"
            hint="epssys sendet bei abonnierten Events einen signierten POST an deine URL."
          />
          <Button size="sm" variant="secondary" icon={<BookOpen size={14} />} onClick={() => setDocsOpen(true)} style={{ flexShrink: 0 }}>
            Dokumentation
          </Button>
        </div>

        {/* Add form — URL row (label above · input + button aligned · hint below), event picker below */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--faint)', marginBottom: 6 }}>Endpoint-URL</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
              placeholder="https://…"
              maxLength={1000}
              style={{ flex: 1, minWidth: 0 }}
            />
            <Button icon={<Plus size={15} />} loading={creating} onClick={create} style={{ flexShrink: 0 }}>Webhook hinzufügen</Button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6 }}>Wohin sollen wir die Events senden? Muss öffentlich erreichbar sein.</div>
          <Field label="Events" hint="Wähle, welche Events an diesen Endpoint gesendet werden." style={{ marginTop: 16, marginBottom: 0 }}>
            <EventPicker value={events} onChange={setEvents} idPrefix="new-webhook" />
          </Field>
        </div>

        {/* Existing endpoints */}
        {webhooks.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '36px 24px', borderRadius: 18, background: '#FAFAF9', border: '1.5px dashed #E4E3DF', textAlign: 'center' }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: '#fff', border: '1px solid #E4E3DF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B0AFA9', flexShrink: 0 }}>
              <Webhook size={20} />
            </span>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#505050' }}>Noch keine Webhooks</div>
            <div style={{ fontSize: 12.5, color: '#909090', maxWidth: 320, lineHeight: 1.5 }}>Fügen Sie einen Endpoint hinzu, um bei Events automatisch benachrichtigt zu werden — z. B. für Automatisierungen oder Ihr eigenes Backend.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {webhooks.map((item) => (
              <WebhookRow key={item.id} item={item} onDelete={setToDelete} />
            ))}
          </div>
        )}

        {/* Signature + events hint */}
        <div style={{ marginTop: 22, paddingTop: 22, borderTop: '1px solid #EDECE9' }}>
          <Subhead icon={<Link2 size={16} />} title="Signatur & Events" hint="So verifizierst du, dass ein Request wirklich von epssys stammt." />
          <div style={{ fontSize: 13, color: '#505050', lineHeight: 1.65 }}>
            Signatur-Header{' '}
            <code style={{ fontSize: 12, fontWeight: 600, color: '#0A0A0A', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', background: '#F4F3F0', border: '1px solid #E4E3DF', borderRadius: 7, padding: '2px 7px' }}>X-Epssys-Signature</code>
            {' '}={' '}
            <code style={{ fontSize: 12, fontWeight: 600, color: '#0A0A0A', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', background: '#F4F3F0', border: '1px solid #E4E3DF', borderRadius: 7, padding: '2px 7px' }}>HMAC-SHA256(Body, Secret)</code>.
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#909090', marginRight: 2 }}>Events:</span>
            {WEBHOOK_EVENTS.map((ev) => (
              <code key={ev.key} style={{
                fontSize: 12, fontWeight: 600, color: '#0A0A0A', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                background: '#F4F3F0', border: '1px solid #E4E3DF', borderRadius: 8, padding: '4px 9px',
              }}>
                {ev.key}
              </code>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDocsOpen(true)}
            style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
          >
            <BookOpen size={14} /> Vollständige Webhook-Dokumentation
          </button>
        </div>
      </Card>

      {/* Right-side docs drawer */}
      <WebhookDocsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Webhook entfernen?"
        message={`Der Endpoint „${toDelete?.url ?? ''}“ erhält keine Events mehr. Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Entfernen"
        danger
        loading={deleting}
      />
    </div>
  );
}

/* ─── section: Abrechnung (Billing) ──────────────────────────────── */
function BillingSection({ agency, canEdit }: { agency: AgencySettings; canEdit: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<Plan | null>(null);
  const currentPlan = (agency.plan as Plan) ?? 'free';

  async function choose(plan: Plan) {
    if (plan === currentPlan) return;
    setBusy(plan);
    try {
      const res = await startCheckout(plan);
      if (res.url) { window.location.href = res.url; return; }
      if (!res.configured) { toast.error('Zahlungen sind in dieser Umgebung nicht aktiviert (Demo-Modus).'); }
      else { toast.success(plan === 'free' ? 'Auf Free herabgestuft.' : 'Plan aktualisiert.'); window.location.reload(); }
    } catch {
      toast.error('Checkout konnte nicht gestartet werden.');
    }
    setBusy(null);
  }

  return (
    <div>
      <HeroHead
        eyebrow="Abrechnung"
        title="Abrechnung & Plan"
        subtitle="Verwalten Sie Ihr Abonnement. Upgrades schalten White-Label, mehr Speicher und Team-Plätze frei."
        icon={<CreditCard size={24} />}
      >
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Aktueller Plan</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.6px', lineHeight: 1, color: '#fff' }}>{PLAN_LIMITS[currentPlan].label}</div>
        </div>
      </HeroHead>

      <Card>
        <div className="settings-plan-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {PLAN_ORDER.map((plan) => {
            const lim = PLAN_LIMITS[plan];
            const isCurrent = plan === currentPlan;
            const isUpgrade = PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(currentPlan);
            return (
              <div key={plan} style={{
                position: 'relative',
                border: `2px solid ${isCurrent ? 'var(--accent)' : '#E4E3DF'}`,
                borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 6,
                background: isCurrent ? 'rgba(var(--accent-rgb),.05)' : '#fff',
                boxShadow: isCurrent ? '0 0 0 4px rgba(var(--accent-rgb),.1)' : 'none',
                transition: `transform .25s ${EASE}, box-shadow .25s ${EASE}`,
              }}>
                {isCurrent && (
                  <span style={{ position: 'absolute', top: 16, right: 16, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#fff', background: 'var(--accent)', padding: '4px 9px', borderRadius: 100, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={11} strokeWidth={3} /> Aktiv</span>
                )}
                <span style={{ fontSize: 16, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.3px' }}>{lim.label}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1, color: isCurrent ? 'var(--accent)' : '#0A0A0A' }}>{lim.priceEur}€</span>
                  <span style={{ fontSize: 12, color: '#909090', fontWeight: 500 }}>/Monat</span>
                </div>
                <div style={{ fontSize: 12.5, color: '#909090', lineHeight: 1.55, marginTop: 4, marginBottom: 10 }}>
                  {lim.clients === Infinity ? 'Unbegrenzte Kunden' : `${lim.clients} Kunde`} · {lim.teamMembers === Infinity ? '∞ Team' : `${lim.teamMembers} Team`} · {lim.storageMb >= 1000 ? `${lim.storageMb / 1000} GB` : `${lim.storageMb} MB`}
                </div>
                <div style={{ marginTop: 'auto' }}>
                  {isCurrent ? (
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={14} /> Ihr aktiver Plan</div>
                  ) : canEdit ? (
                    <Button size="sm" variant={isUpgrade ? 'primary' : 'secondary'} loading={busy === plan} onClick={() => choose(plan)} style={{ width: '100%' }}>
                      {isUpgrade ? 'Upgrade' : 'Wechseln'}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {!canEdit && <ReadOnlyHint />}
      </Card>
    </div>
  );
}

/* ─── helpers ───────────────────────────────────────────────────── */
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return `rgba(10,10,10,${alpha})`;
  const [r, g, b] = m.slice(0, 3).map((h) => parseInt(h, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Perceived-luminance check so light swatches/backgrounds get readable contrast. */
function isLightColor(hex: string): boolean {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return false;
  const [r, g, b] = m.slice(0, 3).map((h) => parseInt(h, 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) > 186;
}

/** Native <input type="color"> needs a clean 7-char hex; fall back to black. */
function normalizeHex(hex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#0A0A0A';
}

/* ─── main view ─────────────────────────────────────────────────── */
export function SettingsView({
  agency, user, canEditWhiteLabel, canEditProfile, canEditBilling,
  canViewAudit = false, auditLog = [], canManageApiKeys = false, apiKeys = [], webhooks = [],
}: {
  agency: AgencySettings;
  user: UserSettings;
  canEditWhiteLabel: boolean;
  canEditProfile: boolean;
  canEditBilling: boolean;
  canViewAudit?: boolean;
  auditLog?: AuditLogEntry[];
  canManageApiKeys?: boolean;
  apiKeys?: ApiKeyListItem[];
  webhooks?: WebhookListItem[];
}) {
  const [active, setActive] = useState<Section>('profil');
  const [sectionNavOpen, setSectionNavOpen] = useState(false);
  const activeItem = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === active)!;
  const ActiveIcon = activeItem.icon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sticky topbar */}
      <header className="cos-topbar" style={{ background: '#fff', borderBottom: '1px solid #E4E3DF', height: 60, padding: '0 28px', position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NavToggle />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.6px', color: '#0A0A0A' }}>Einstellungen</span>
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#909090', display: 'flex', alignItems: 'center', gap: 7 }} className="settings-crumb">
          <span style={{ color: '#B0AFA9' }}>Einstellungen</span>
          <span style={{ color: '#D4D3CF' }}>/</span>
          <span style={{ color: '#0A0A0A' }}>{SECTION_TITLES[active]}</span>
        </span>
      </header>

      {/* Two-column layout */}
      <div className="settings-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: '236px minmax(0, 1fr)', gap: 24, padding: '24px 28px 56px', alignItems: 'start' }}>
        {/* Left nav — richer sidebar card */}
        <nav className="settings-nav cos-desktop-only" style={{ position: 'sticky', top: 84, background: '#fff', border: '1px solid #E4E3DF', borderRadius: 20, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} style={{ marginTop: gi > 0 ? 10 : 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.14em', color: '#B0AFA9', padding: '6px 12px 8px' }}>{group.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {group.items.map(({ id, label, icon: Icon }) => {
                  const isActive = active === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setActive(id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 13, border: 'none',
                        background: isActive ? '#0A0A0A' : 'transparent', color: isActive ? '#fff' : '#505050',
                        fontSize: 13.5, fontWeight: isActive ? 600 : 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        transition: `background ${ease}, color ${ease}`, position: 'relative',
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#F4F3F0'; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isActive ? 'var(--accent)' : '#F4F3F0', color: isActive ? '#fff' : '#909090',
                        transition: `background ${ease}, color ${ease}`,
                      }}>
                        <Icon size={15} strokeWidth={2} />
                      </span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Right content */}
        <div className="settings-content" style={{ maxWidth: 1000, width: '100%' }}>
          {/* Mobile: section navigation lives behind a button → animated bottom-sheet */}
          <button
            className="cos-mobile-only"
            onClick={() => setSectionNavOpen(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
              padding: '11px 14px', borderRadius: 14, border: '1px solid #E4E3DF', background: '#fff',
              cursor: 'pointer', textAlign: 'left', boxShadow: '0 1px 2px rgba(0,0,0,.03)',
            }}
          >
            <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ActiveIcon size={17} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: '#B0AFA9', lineHeight: 1.4 }}>Bereich</span>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: '#0A0A0A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SECTION_TITLES[active]}</span>
            </span>
            <ChevronDown size={19} style={{ color: '#909090', flexShrink: 0 }} />
          </button>

          {active === 'profil' && <ProfilSection agency={agency} canEdit={canEditProfile} />}
          {active === 'whitelabel' && <WhiteLabelSection agency={agency} canEdit={canEditWhiteLabel} />}
          {active === 'mein-profil' && <MeinProfilSection user={user} />}
          {active === 'benachrichtigungen' && <BenachrichtigungenSection user={user} />}
          {active === 'abrechnung' && <BillingSection agency={agency} canEdit={canEditBilling} />}
          {active === 'sicherheit' && (
            <div>
              <HeroHead
                eyebrow="Konto"
                title="Sicherheit"
                subtitle="Sicherheitsrelevante Aktionen Ihres Teams im Blick — wer hat was wann geändert."
                icon={<Shield size={24} />}
              />
              {canViewAudit && <AuditLogSection entries={auditLog} />}
            </div>
          )}
          {active === 'api' && (
            <div>
              <HeroHead
                eyebrow="Entwickler"
                title="API & Webhooks"
                subtitle="Integrieren Sie epssys in Ihre eigenen Systeme — REST-API-Schlüssel und ausgehende Webhooks."
                icon={<Webhook size={24} />}
              />
              {canManageApiKeys && (
                <>
                  <ApiKeysSection apiKeys={apiKeys} />
                  <WebhooksSection webhooks={webhooks} />
                </>
              )}
            </div>
          )}
          {active === 'support' && (
            <div>
              <HeroHead
                eyebrow="Hilfe"
                title="Support"
                subtitle="Ihre Support-Daten und der direkte Draht zu unserem Team."
                icon={<LifeBuoy size={24} />}
              />
              <SupportInfoCard customerNumber={agency.customerNumber} supportPin={agency.supportPin} />
              <DirekterKontaktCard />
            </div>
          )}
        </div>
      </div>

      {/* Mobile section-nav drawer (animated bottom-sheet) */}
      <Drawer
        open={sectionNavOpen}
        onClose={() => setSectionNavOpen(false)}
        side="bottom"
        title="Bereich wählen"
        subtitle="Springe direkt zu einem Einstellungsbereich."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.14em', color: '#B0AFA9', padding: '0 2px 8px' }}>{group.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {group.items.map(({ id, label, icon: Icon }) => {
                  const isActive = active === id;
                  return (
                    <button
                      key={id}
                      onClick={() => { setActive(id); setSectionNavOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 13px', borderRadius: 14, border: 'none',
                        background: isActive ? '#0A0A0A' : '#F7F6F3', color: isActive ? '#fff' : '#1C1B18',
                        fontSize: 15, fontWeight: isActive ? 700 : 600, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit',
                        transition: `background ${EASE} .2s, color ${EASE} .2s`,
                      }}
                    >
                      <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'var(--accent)' : '#EDECE9', color: isActive ? '#fff' : '#909090' }}>
                        <Icon size={17} strokeWidth={2} />
                      </span>
                      {label}
                      {isActive && <Check size={17} style={{ marginLeft: 'auto' }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Drawer>

      <style>{`
        @keyframes webhookEditorIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 860px) {
          .settings-form-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .settings-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .settings-plan-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .settings-nav { position: static !important; }
        }
        @media (max-width: 720px) {
          .settings-crumb { display: none !important; }
        }
      `}</style>
    </div>
  );
}
