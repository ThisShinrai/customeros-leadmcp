'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { getVapidPublicKey, savePushSubscription, removePushSubscription } from '@/lib/push/actions';

function urlB64ToUint8(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Push-notification opt-in: requests permission, subscribes, persists the subscription. */
export function PushOptIn() {
  const toast = useToast();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (ok) {
      navigator.serviceWorker.ready
        .then((r) => r.pushManager.getSubscription())
        .then((s) => setSubscribed(!!s))
        .catch(() => {});
    }
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast.error('Browser-Berechtigung wurde nicht erteilt.'); setBusy(false); return; }
      const pub = await getVapidPublicKey();
      if (!pub) { toast.error('Push ist serverseitig noch nicht aktiviert.'); setBusy(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(pub) as BufferSource });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const res = await savePushSubscription({ endpoint: json.endpoint ?? '', keys: json.keys });
      if (res.ok) { setSubscribed(true); toast.success('Push-Benachrichtigungen aktiviert.'); }
      else toast.error('Konnte nicht aktiviert werden.');
    } catch { toast.error('Aktivierung fehlgeschlagen.'); }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setSubscribed(false);
      toast.success('Push-Benachrichtigungen deaktiviert.');
    } catch { toast.error('Konnte nicht deaktiviert werden.'); }
    setBusy(false);
  }

  if (!supported) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: '14px 16px', borderRadius: 14, border: '1px solid #E4E3DF', background: '#FAFAF9', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: subscribed ? 'rgba(var(--accent-rgb),.12)' : '#F1F1EF', color: subscribed ? 'var(--accent)' : '#909090', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {subscribed ? <BellRing size={17} /> : <BellOff size={17} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0A0A0A' }}>Push-Benachrichtigungen</div>
          <div style={{ fontSize: 12.5, color: '#909090', lineHeight: 1.5 }}>
            {subscribed ? 'Aktiv auf diesem Gerät.' : 'Direkt aufs Gerät — auch bei geschlossener App.'}
          </div>
        </div>
      </div>
      {subscribed
        ? <Button variant="secondary" size="sm" loading={busy} onClick={disable} icon={<BellOff size={14} />} style={{ flexShrink: 0 }}>Deaktivieren</Button>
        : <Button size="sm" loading={busy} onClick={enable} icon={<BellRing size={14} />} style={{ flexShrink: 0 }}>Aktivieren</Button>}
    </div>
  );
}
