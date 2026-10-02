import crypto from 'node:crypto';
import fs from 'node:fs';

const SECRET = (process.env.CHAT_SECRET || fs.readFileSync('/tmp/chat_secret', 'utf8')).trim();
const HOST = process.env.CHAT_WS_URL;
if (!HOST) { console.log('CHAT_WS_URL not set'); process.exit(1); }
const channelId = process.argv[2];
if (!channelId) { console.log('no channel id'); process.exit(1); }

const b64url = (s) => Buffer.from(s).toString('base64url');
function mint(u) {
  const payload = { c: channelId, u, ty: 'agency_user', a: 'wstest', e: Date.now() + 300000 };
  const p = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  return `${p}.${sig}`;
}
const url = (u) => `${HOST}/ws?room=${channelId}&token=${encodeURIComponent(mint(u))}`;

const marker = '__wstest__' + Date.now();
let got = false, opens = 0, done = false;

const ws1 = new WebSocket(url('wstest-user1'));
const ws2 = new WebSocket(url('wstest-user2'));

function maybeSend() {
  if (++opens === 2) {
    console.log('  both sockets open → sending from ws1');
    setTimeout(() => ws1.send(JSON.stringify({ type: 'msg', content: marker + ' hallo' })), 300);
  }
}
function finish() {
  if (done) return; done = true;
  console.log(got ? '\n✅ REALTIME WS OK (broadcast + persist)\n' : '\n❌ no broadcast received\n');
  try { ws1.close(); ws2.close(); } catch {}
  process.exit(got ? 0 : 1);
}

ws1.onopen = () => { console.log('  ws1 open'); maybeSend(); };
ws2.onopen = () => { console.log('  ws2 open'); maybeSend(); };
ws1.onerror = (e) => console.log('  ws1 error', e?.message || String(e));
ws2.onerror = (e) => console.log('  ws2 error', e?.message || String(e));
ws2.onmessage = (e) => {
  let d; try { d = JSON.parse(e.data); } catch { return; }
  if (d.type === 'msg' && d.message?.content?.includes(marker)) {
    got = true;
    console.log('  ✅ ws2 received:', d.message.content, '(id', d.message.id + ')');
    finish();
  }
};
setTimeout(() => { console.log('  timeout'); finish(); }, 12000);
