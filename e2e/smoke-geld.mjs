import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };

try {
  await loginAgency(page);

  console.log('\n=== Zeiterfassung ===');
  await page.goto(`${BASE}/app/a/time`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok((await page.getByText(/Zeiterfassung/i).first().count()) > 0, '/app/a/time lädt');
  await page.getByRole('button', { name: /Zeit erfassen/i }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  ok((await page.getByText(/Projekt/i).count()) > 0 && (await page.getByText(/Beschreibung/i).count()) > 0, 'Erfassen-Drawer hat Projekt + Beschreibung');
  await shot(page, 'geld-01-time-drawer');
  // best-effort: log an entry
  try {
    await page.locator('select').first().selectOption({ index: 1 });
    await page.getByPlaceholder(/.*/).first(); // noop
    const desc = page.locator('input[type="text"], textarea').first();
    await desc.fill('Konzeption (Smoke)');
    const nums = page.locator('input[inputmode="numeric"], input[type="number"]');
    if (await nums.count()) await nums.first().fill('2');
    await page.getByRole('button', { name: /Erfassen|Speichern|Hinzufügen/i }).last().click();
    await page.waitForTimeout(1200);
    ok((await page.getByText('Konzeption (Smoke)').count()) > 0, 'Zeit-Eintrag erscheint');
  } catch (e) { console.log('  (Eintrag-Erstellung übersprungen:', e.message.slice(0, 60), ')'); }
  await shot(page, 'geld-02-time-list');

  console.log('\n=== Wiederkehrende Rechnungen ===');
  await page.goto(`${BASE}/app/a/recurring`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok((await page.getByText(/Wiederkehrend/i).first().count()) > 0, '/app/a/recurring lädt');
  await page.getByRole('button', { name: /Neue Vorlage|Vorlage/i }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  ok((await page.getByText(/Intervall/i).count()) > 0, 'Vorlage-Drawer hat Intervall');
  await shot(page, 'geld-03-recurring-drawer');

  console.log('\n=== Rechnungen (Mahnwesen) ===');
  await page.goto(`${BASE}/app/a/invoices`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok((await page.getByText(/Rechnung/i).first().count()) > 0, '/app/a/invoices lädt');
  await shot(page, 'geld-04-invoices');

  const real = errs.filter((e) => !/favicon|manifest|404|Failed to load resource/i.test(e));
  ok(real.length === 0, `Keine Konsolenfehler (${real.length})`);
  real.slice(0, 5).forEach((e) => console.log('     ⚠', e));

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'geld-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
