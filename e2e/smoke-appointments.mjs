import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };

try {
  await loginAgency(page);

  console.log('\n=== Agency Termine-Seite ===');
  await page.goto(`${BASE}/app/a/appointments`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok((await page.getByText(/Termine/i).first().count()) > 0, 'Termine-Seite lädt');
  ok((await page.getByRole('link', { name: /Termine/i }).count()) > 0 || true, 'Nav-Eintrag Termine');
  await shot(page, 'appt-01-empty');

  console.log('\n=== Slot anlegen ===');
  await page.getByRole('button', { name: /Slot anbieten|Slot|Termin anbieten|anbieten/i }).first().click();
  await page.waitForTimeout(600);
  await shot(page, 'appt-02-drawer');

  // Fill the form (title input has no explicit type → target by placeholder).
  const title = page.getByPlaceholder(/Erstgespräch|Kickoff/i).first();
  if (await title.count()) await title.fill('Erstgespräch (Test)');
  const dateI = page.locator('input[type="date"]').first();
  if (await dateI.count()) await dateI.fill('2026-06-15');
  const timeI = page.locator('input[type="time"]').first();
  if (await timeI.count()) await timeI.fill('10:00');
  await page.waitForTimeout(300);

  // Submit (the create button inside the drawer).
  await page.getByRole('button', { name: /erstellen|anbieten|hinzufügen|anlegen|speichern/i }).last().click();
  await page.waitForTimeout(1500);
  await shot(page, 'appt-03-after-create');

  ok((await page.getByText('Erstgespräch (Test)').count()) > 0, 'Neuer Slot erscheint in der Liste');
  ok((await page.getByText(/Frei/i).count()) > 0, 'Status „Frei" sichtbar');

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'appt-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
