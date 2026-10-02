import { launch, loginAgency, shot, BASE } from './helpers.mjs';
const { browser, page } = await launch();
let fail = 0; const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) fail++; };
const msg = `DM-Test ${Date.now()}`;
try {
  await loginAgency(page);
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  console.log('\n1. Open chat + New chat');
  await page.locator('button[aria-label="Chat öffnen"]').click();
  await page.waitForTimeout(900);
  await page.locator('button[title="Neuer Chat"]').first().click();
  await page.waitForTimeout(1200);
  const contactCount = await page.getByText(/Kunde ·|Team ·/).count();
  ok(contactCount > 0, `contacts listed (${contactCount})`);
  await shot(page, 'c2-01-contacts');
  console.log('\n2. Start DM + send');
  await page.locator('text=/Kunde ·/').first().click();
  await page.waitForTimeout(1200);
  const input = page.getByPlaceholder('Nachricht schreiben…');
  ok(await input.isVisible().catch(() => false), 'DM conversation opened');
  await input.fill(msg);
  await input.press('Enter');
  await page.waitForTimeout(1500);
  ok(await page.getByText(msg).first().isVisible().catch(() => false), 'DM message sent + visible');
  await shot(page, 'c2-02-dm');
} catch (e) { console.log('💥', e.message); await shot(page, 'c2-err').catch(()=>{}); fail++; }
finally { await browser.close(); console.log(`\n${fail===0?'✅ PASSED':`❌ ${fail} FAIL`}\n`); process.exit(fail===0?0:1); }
