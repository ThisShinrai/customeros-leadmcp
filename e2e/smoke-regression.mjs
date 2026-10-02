import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) consoleErrors.push(m.text().slice(0, 120)); });
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };

const PAGES = [
  ['/dashboard', /Aktive Projekte|Willkommen/i],
  ['/projects', /Projekte/i],
  ['/clients', /Kunden/i],
  ['/team', /Team-Mitglieder|Team/i],
  ['/invoices', /Rechnungen/i],
  ['/settings', /Einstellungen/i],
];

try {
  await loginAgency(page);
  console.log('\n=== Agency pages load ===');
  for (const [path, marker] of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    const visible = await page.getByText(marker).first().isVisible().catch(() => false);
    ok(visible, `${path} renders`);
  }

  console.log('\n=== Project detail loads ===');
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
  await page.locator('a[href^="/projects/"]').first().click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]+$/);
  await page.waitForTimeout(700);
  ok(await page.getByText(/Aufgaben/i).first().isVisible().catch(() => false), 'project detail renders');

  console.log('\n=== Settings sections ===');
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.getByText('Abrechnung').first().click();
  await page.waitForTimeout(400);
  ok(await page.getByText(/Aktueller Plan/i).first().isVisible().catch(() => false), 'billing section renders');
  await shot(page, 'reg-settings-billing');

  console.log('\n=== Console errors ===');
  ok(consoleErrors.length === 0, `no console errors (${consoleErrors.length})`);
  if (consoleErrors.length) consoleErrors.slice(0, 5).forEach((e) => console.log('     ⚠', e));

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'reg-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ ALL PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
