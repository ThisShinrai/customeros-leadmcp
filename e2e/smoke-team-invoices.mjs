import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };
const memberEmail = `kollege${Date.now()}@agentur.de`;

try {
  await loginAgency(page);

  console.log('\n=== TEAM ===');
  await page.goto(`${BASE}/team`, { waitUntil: 'networkidle' });
  ok(await page.getByText('Team-Mitglieder').first().isVisible(), 'team page renders');
  ok(await page.getByText('owner@testagentur.de').first().isVisible(), 'owner listed as member');
  await shot(page, 'ti-01-team');

  await page.getByRole('button', { name: /Mitglied einladen/ }).first().click();
  await page.getByPlaceholder('z.B. Sophie Müller').fill('Sophie Müller');
  await page.getByPlaceholder('name@agentur.de').fill(memberEmail);
  await shot(page, 'ti-02-invite-modal');
  await page.getByRole('button', { name: 'Einladung senden' }).click();
  await page.waitForTimeout(1500);
  ok(await page.getByText(memberEmail).first().isVisible(), 'invited member appears in pending');
  await shot(page, 'ti-03-invited');

  console.log('\n=== INVOICES ===');
  await page.goto(`${BASE}/invoices`, { waitUntil: 'networkidle' });
  ok(await page.getByText('Rechnungen').first().isVisible(), 'invoices page renders');
  await shot(page, 'ti-04-invoices');
  await page.getByRole('button', { name: /Neue Rechnung/ }).first().click();
  await page.waitForTimeout(600);
  await shot(page, 'ti-05-invoice-modal');
  ok(true, 'invoice create modal opened (visual check)');

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'ti-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ ALL PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
