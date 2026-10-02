import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };
const PDF = 'C:/Users/papsn/Desktop/customer-os/e2e/test-invoice.pdf';

try {
  await loginAgency(page);
  await page.goto(`${BASE}/invoices`, { waitUntil: 'networkidle' });

  console.log('\n1. Create invoice WITH PDF (tests R2 putObject)');
  await page.getByRole('button', { name: /Neue Rechnung/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByPlaceholder(/Phase 2|z\.B\./).first().fill('Rechnung RE-2026-001');
  const selects = page.locator('select');
  await selects.nth(0).selectOption({ index: 1 });
  await selects.nth(1).selectOption({ index: 1 });
  await page.locator('input').filter({ hasText: '' }).nth(0); // noop
  await page.locator('input[placeholder*="2.400"]').first().fill('2400,00');
  await page.locator('input[type=file]').setInputFiles(PDF);
  await page.getByRole('button', { name: 'Rechnung erstellen' }).click();
  await page.waitForTimeout(2500);
  const created = await page.getByText('Rechnung RE-2026-001').first().isVisible().catch(() => false);
  ok(created, 'invoice row appears after create');
  await shot(page, 'inv-01-created');

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'inv-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
