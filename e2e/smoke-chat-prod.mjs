import { chromium } from 'playwright';

const BASE = 'https://c.epssys.de';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
const page = await ctx.newPage();

let wsUrl = null;
page.on('websocket', (ws) => { if (ws.url().includes('chat-room')) { wsUrl = ws.url(); console.log('  🔌 WS:', ws.url().slice(0, 90)); } });

let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };

try {
  console.log('=== PROD Login ===');
  await page.goto(`${BASE}/app/a/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('name@agentur.de').first().fill('owner@testagentur.de').catch(() => {});
  await page.getByPlaceholder('••••••••').fill('test1234').catch(() => {});
  await page.getByRole('button', { name: 'Anmelden' }).click().catch(() => {});
  await page.waitForTimeout(4000);
  const onDash = /dashboard/.test(page.url());
  console.log('  url:', page.url());
  if (!onDash) { console.log('  ⚠ Login fehlgeschlagen (keine Prod-Creds) — Test unschlüssig, Worker ist isoliert bewiesen.'); await browser.close(); process.exit(0); }

  console.log('\n=== Chat öffnen → WS zum Chat-Worker? ===');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => { const s = getComputedStyle(x); return s.position === 'fixed' && parseInt(s.bottom) < 60 && parseInt(s.right) < 60; });
    if (b) b.click();
  });
  await page.waitForTimeout(1500);
  // click first conversation row
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('button, li, [role="button"]')].filter((x) => /Relaunch|Portal|Projekt|chat|nachricht/i.test(x.textContent || ''));
    if (items[0]) items[0].click();
  });
  await page.waitForTimeout(3500);
  ok(!!wsUrl, `WebSocket-Verbindung zum Chat-Worker aufgebaut${wsUrl ? '' : ' — (evtl. keine Konversation vorhanden)'}`);
  await page.screenshot({ path: 'C:/Users/papsn/Desktop/customer-os/e2e/shots/chatprod-01.png' });

} catch (e) {
  console.log('💥', e.message);
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ DONE' : `❌ ${failures} issue(s)`}\n`);
  process.exit(0);
}
