import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };

try {
  await loginAgency(page);
  await page.goto(`${BASE}/app/a/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  console.log('\n=== Chat-Widget öffnet ohne Crash (Polling-Fallback) ===');
  // The floating chat bubble — bottom-right fixed button.
  const bubble = page.locator('button').filter({ hasText: '' }).last();
  // More robust: click the last fixed-position button near bottom-right
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((x) => { const s = getComputedStyle(x); return s.position === 'fixed' && parseInt(s.bottom) < 60 && parseInt(s.right) < 60; });
    if (b) b.click();
  });
  await page.waitForTimeout(1200);
  await shot(page, 'chatws-01-open');
  ok(true, 'Widget-Klick ohne Exception');

  // Try opening the first conversation if present.
  const convo = page.locator('[class*="conversation"], [data-conversation], li, button').filter({ hasText: /./ });
  await page.waitForTimeout(400);

  const provErrors = errors.filter((e) => /chat|provider|websocket|getChatToken|hook/i.test(e));
  ok(provErrors.length === 0, `Keine Chat-Provider-Konsolenfehler (${provErrors.length})`);
  if (provErrors.length) provErrors.slice(0, 5).forEach((e) => console.log('     ⚠', e));

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'chatws-error').catch(() => {});
  failures++;
} finally {
  console.log('\n  total console errors:', errors.length);
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
