/**
 * Edge-compatible Web Push (RFC 8291 aes128gcm content encryption + RFC 8292
 * VAPID) using only Web Crypto — works on the Cloudflare Workers runtime.
 * Best-effort: callers wrap this; a malformed/expired subscription just fails.
 */

export interface PushSub { endpoint: string; p256dh: string; auth: string }
export interface VapidKeys { publicKey: string; privateJwk: JsonWebKey; subject: string }

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const bin = atob(s + '='.repeat(pad));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64url(b: ArrayBuffer | Uint8Array): string {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

const te = new TextEncoder();

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, key, length * 8);
  return new Uint8Array(bits);
}

/** RFC 8292 VAPID Authorization header (ES256 JWT). */
async function vapidAuth(endpoint: string, vapid: VapidKeys): Promise<string> {
  const url = new URL(endpoint);
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: `${url.protocol}//${url.host}`, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: vapid.subject };
  const signingInput = `${bytesToB64url(te.encode(JSON.stringify(header)))}.${bytesToB64url(te.encode(JSON.stringify(payload)))}`;
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(signingInput));
  return `vapid t=${signingInput}.${bytesToB64url(sig)}, k=${vapid.publicKey}`;
}

/** RFC 8291 aes128gcm encryption of the payload for the subscription keys. */
async function encrypt(payload: Uint8Array, p256dh: Uint8Array, auth: Uint8Array): Promise<Uint8Array> {
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const ephPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey)); // 65 bytes (0x04||X||Y)
  const clientPub = await crypto.subtle.importKey('raw', p256dh as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPub }, eph.privateKey, 256));

  // PRK = HKDF(auth, ecdh, "WebPush: info\0" || clientPub || serverPub, 32)
  const prk = await hkdf(auth, shared, concat(te.encode('WebPush: info\0'), p256dh, ephPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, prk, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, prk, te.encode('Content-Encoding: nonce\0'), 12);

  const record = concat(payload, new Uint8Array([2])); // 0x02 = last-record delimiter, no padding
  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource, tagLength: 128 }, aesKey, record as BufferSource));

  const rs = 4096;
  const rsBytes = new Uint8Array([(rs >>> 24) & 255, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255]);
  // aes128gcm header: salt(16) | rs(4) | idlen(1)=65 | keyid(ephPub, 65) | ciphertext
  return concat(salt, rsBytes, new Uint8Array([65]), ephPub, ct);
}

export async function sendPush(sub: PushSub, payloadJson: string, vapid: VapidKeys): Promise<{ ok: boolean; status: number }> {
  const body = await encrypt(te.encode(payloadJson), b64urlToBytes(sub.p256dh), b64urlToBytes(sub.auth));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuth(sub.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '2419200',
    },
    body: body as BodyInit,
    signal: AbortSignal.timeout(6000),
  });
  return { ok: res.ok, status: res.status };
}
