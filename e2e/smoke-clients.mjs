import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };
const email = `kunde${Date.now()}@beispiel.de`;

try {
  await loginAgency(page);
  console.log('\n1. Clients page');
  await page.goto(`${BASE}/clients`, { waitUntil: 'networkidle' });
  ok(await page.getByText('Kunden').first().isVisible(), 'Kunden page visible');
  await shot(page, 'cl-01-list');

  console.log('\n2. Invite client');
  await page.getByRole('button', { name: /Kunde einladen|Ersten Kunden/ }).first().click();
  await page.getByPlaceholder('Maria Klein').fill('Maria Klein');
  await page.getByPlaceholder('maria@firma.de').fill(email);
  await page.getByPlaceholder('Klein & Partner GmbH').fill('Klein & Partner GmbH');
  await shot(page, 'cl-02-modal');
  await page.getByRole('button', { name: 'Einladung senden' }).click();
  await page.waitForTimeout(1500);
  ok(await page.getByText('Maria Klein').first().isVisible(), 'client card appears after invite');
  await shot(page, 'cl-03-invited');

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'cl-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\nInvited email: ${email}`);
  console.log(`${failures === 0 ? '✅ ALL PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
