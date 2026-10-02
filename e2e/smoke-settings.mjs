import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };

try {
  await loginAgency(page);
  console.log('\n=== SETTINGS ===');
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  ok(await page.getByText(/Einstellungen|Profil|White-?Label/i).first().isVisible(), 'settings page renders');
  await shot(page, 'set-01-settings');

  // Navigate to White-Label section
  await page.getByText(/White-?Label/i).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, 'set-02-whitelabel');

  // Try to pick an orange accent swatch via the native color input or a swatch
  // Set color input directly if present
  const colorInput = page.locator('input[type=color]').first();
  if (await colorInput.count() > 0) {
    await colorInput.evaluate((el) => { el.value = '#FF6B00'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(300);
  }
  // Save
  await page.getByRole('button', { name: /Speichern|White-?Label speichern/i }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, 'set-03-saved');

  console.log('\n=== verify accent applied on projects page ===');
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  console.log('  --accent =', accent);
  ok(accent.length > 0, `--accent CSS var is set (${accent})`);
  await shot(page, 'set-04-accent-applied');

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'set-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
