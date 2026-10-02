import { launch, loginAgency, BASE, SHOT_DIR } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };
const shotClip = async (name) => { await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, clip: { x: 0, y: 0, width: 340, height: 900 } }); console.log('  📸', name); };

try {
  await loginAgency(page);
  await page.goto(`${BASE}/app/a/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  console.log('\n=== AGENCY SIDEBAR — Gruppierung ===');
  for (const label of ['Übersicht', 'Arbeit', 'Kontakte', 'Finanzen']) {
    ok((await page.getByText(label, { exact: true }).count()) > 0, `Gruppe "${label}" sichtbar`);
  }
  ok((await page.getByRole('link', { name: 'Einstellungen' }).count()) > 0, '"Einstellungen" (angepinnt) vorhanden');
  await shotClip('nav-01-agency-expanded');

  console.log('\n=== Collapse → Badge dauerhaft sichtbar ===');
  await page.getByRole('button', { name: 'Navigation einklappen' }).click();
  await page.waitForTimeout(700);
  // The persistent expand badge: a ChevronRight inside the collapsed logo box, opacity must be 1.
  const badgeOpacity = await page.evaluate(() => {
    // find the svg chevron-right that is NOT inside the (hidden) collapse button
    const svgs = [...document.querySelectorAll('aside svg')];
    for (const svg of svgs) {
      const wrap = svg.parentElement;
      if (!wrap) continue;
      const cs = getComputedStyle(wrap);
      // badge wrapper is a small absolutely-positioned circle (18px) bottom-right
      if (wrap.style.position === 'absolute' && wrap.style.borderRadius === '50%') {
        return Number(cs.opacity);
      }
    }
    return -1;
  });
  ok(badgeOpacity === 1, `Aufklapp-Badge dauerhaft sichtbar (opacity=${badgeOpacity}, ohne Hover)`);
  await shotClip('nav-02-agency-collapsed');

  console.log('\n=== Re-expand via Badge/Logo ===');
  // Click the collapsed logo box (top-left) to expand again
  await page.mouse.click(40, 40);
  await page.waitForTimeout(700);
  ok((await page.getByText('Finanzen', { exact: true }).count()) > 0, 'Wieder ausgeklappt (Gruppen-Label sichtbar)');
  await shotClip('nav-03-agency-reexpanded');

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await page.screenshot({ path: `${SHOT_DIR}/nav-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
