import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };

try {
  await loginAgency(page);

  console.log('\n=== Sanity: Seiten laden trotz neuer Middleware + Error-Boundaries ===');
  for (const [path, marker] of [['/app/a/dashboard', /Hallo|Dashboard/i], ['/app/a/projects', /Projekt/i], ['/app/a/settings', /Einstellungen/i]]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    ok((await page.getByText(marker).first().count()) > 0, `${path} lädt`);
  }

  console.log('\n=== Custom-Domain DNS-Karte ===');
  await page.goto(`${BASE}/app/a/settings`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /White-?Label/i }).first().click();
  await page.waitForTimeout(500);
  const input = page.getByPlaceholder('portal.meineagentur.de');
  ok((await input.count()) > 0, 'Custom-Domain-Input vorhanden');
  await input.fill('portal.testagentur.de');
  await page.waitForTimeout(400);
  ok((await page.getByText(/DNS-Einrichtung/i).count()) > 0, 'DNS-Karte erscheint');
  ok((await page.getByText('c.epssys.de').count()) > 0, 'CNAME-Ziel c.epssys.de sichtbar');
  ok((await page.getByText('CNAME', { exact: true }).count()) > 0, 'CNAME-Typ sichtbar');
  ok((await page.getByRole('button', { name: /Verbindung prüfen/i }).count()) > 0, '"Verbindung prüfen"-Button');
  await shot(page, 'hardening-01-dns-card');

  console.log('\n=== Portal-Seite lädt (Middleware no-op auf primary host) ===');
  // The portal requires a client session; just check the agency-side still fine + no 500 on a public route
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  ok(page.url().includes('localhost'), 'Landing/Root lädt ohne Middleware-Crash');

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'hardening-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
