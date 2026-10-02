import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };

try {
  console.log('=== Static PWA assets ===');
  for (const [p, type] of [['/manifest.json', /application\/(manifest|json)/], ['/sw.js', /javascript/], ['/icon.svg', /svg/]]) {
    const r = await page.request.get(`${BASE}${p}`);
    ok(r.ok(), `${p} → ${r.status()}`);
  }

  await loginAgency(page);
  console.log('\n=== Push opt-in in Benachrichtigungen ===');
  await page.goto(`${BASE}/app/a/settings`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Benachrichtigungen$/ }).first().click();
  await page.waitForTimeout(600);
  ok((await page.getByText(/Push-Benachrichtigungen/i).count()) > 0, '„Push-Benachrichtigungen" sichtbar');
  ok((await page.getByRole('button', { name: /Aktivieren/i }).count()) > 0, '„Aktivieren"-Button vorhanden');
  await shot(page, 'push-01-optin');

  // service worker registered?
  await page.waitForTimeout(800);
  const swReg = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'no-sw-api';
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.length > 0 ? 'registered' : 'none';
  });
  ok(swReg === 'registered', `Service Worker registriert (${swReg})`);

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'push-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
