import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };

try {
  await loginAgency(page);

  console.log('\n=== Settings → Benachrichtigungen ===');
  await page.goto(`${BASE}/app/a/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  ok((await page.getByRole('button', { name: /^Benachrichtigungen$/ }).count()) > 0, 'Nav: Benachrichtigungen-Reiter');
  await page.getByRole('button', { name: /^Benachrichtigungen$/ }).first().click();
  await page.waitForTimeout(500);
  ok((await page.getByText(/E-Mail-Benachrichtigungen/i).count()) > 0, 'E-Mail-Benachrichtigungen-Auswahl sichtbar');
  ok((await page.getByText(/Sofort/i).count()) > 0 && (await page.getByText(/Aus|Keine/i).count()) > 0, 'Sofort + Aus Optionen');
  await shot(page, 'eng1-01-notif-settings');

  console.log('\n=== Projekt → Dateien → Neuer Ordner ===');
  await page.goto(`${BASE}/app/a/projects`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  // open first project
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href*="/app/a/projects/"]')].find((x) => x.getAttribute('href').split('/').length > 4);
    if (a) a.click();
  });
  await page.waitForTimeout(1500);
  ok(/\/app\/a\/projects\/[^/]+/.test(page.url()), 'Projekt-Detail offen: ' + page.url().split('/').pop());
  const hasNeuerOrdner = (await page.getByRole('button', { name: /Neuer Ordner/i }).count()) > 0;
  ok(hasNeuerOrdner, '„Neuer Ordner"-Button vorhanden');
  if (hasNeuerOrdner) {
    await page.getByRole('button', { name: /Neuer Ordner/i }).first().click();
    await page.waitForTimeout(500);
    const nameInput = page.locator('input[type="text"]').last();
    await nameInput.fill('Design (Smoke)');
    await page.getByRole('button', { name: /Erstellen|Anlegen|Speichern/i }).last().click();
    await page.waitForTimeout(1200);
    ok((await page.getByText('Design (Smoke)').count()) > 0, 'Ordner „Design (Smoke)" erscheint');
  }
  await shot(page, 'eng1-02-folders');

  const real = errs.filter((e) => !/favicon|manifest|404|Failed to load resource/i.test(e));
  ok(real.length === 0, `Keine Konsolenfehler (${real.length})`);
  real.slice(0, 5).forEach((e) => console.log('     ⚠', e));

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'eng1-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
