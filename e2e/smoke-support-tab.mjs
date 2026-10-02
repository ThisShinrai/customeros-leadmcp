import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
let failures = 0;
const ok = (c, m) => { console.log(c ? '  ✅' : '  ❌', m); if (!c) failures++; };

try {
  await loginAgency(page);
  console.log('\n=== SETTINGS — Support-Reiter ===');
  await page.goto(`${BASE}/app/a/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Nav: "Support" present, "Benachrichtigungen" gone
  const navSupport = await page.getByRole('button', { name: /^Support$/ }).count();
  ok(navSupport > 0, 'Nav: "Support"-Eintrag vorhanden');
  const navBenach = await page.getByText(/Benachrichtigungen/i).count();
  ok(navBenach === 0, 'Nav: "Benachrichtigungen" entfernt');
  ok((await page.getByText(/^Hilfe$/).count()) > 0, 'Nav-Gruppe "Hilfe" vorhanden');

  // Profil section should NOT contain the support card anymore
  await page.getByRole('button', { name: /Agentur-Profil/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  const pinOnProfil = await page.getByText(/Support-PIN|Kundennummer/i).count();
  ok(pinOnProfil === 0, 'Profil: Support-Karte (Kundennummer/PIN) ist NICHT mehr hier');
  await shot(page, 'support-01-profil-clean');

  // Open Support tab
  await page.getByRole('button', { name: /^Support$/ }).first().click();
  await page.waitForTimeout(700);
  ok((await page.getByRole('heading', { name: /^Support$/ }).count()) > 0 || (await page.getByText('Hilfe').count()) > 0, 'Support-Hero rendert');
  ok((await page.getByText(/Kundennummer/i).count()) > 0, 'Support: Kundennummer sichtbar');
  ok((await page.getByText(/Direkter Kontakt/i).count()) > 0, 'Support: "Direkter Kontakt"-Karte sichtbar');
  ok((await page.getByText(/contact@epssys\.de/i).count()) > 0, 'Support: Support-E-Mail sichtbar');
  ok((await page.getByText(/Support-Zeiten/i).count()) > 0, 'Support: Support-Zeiten sichtbar');
  ok((await page.getByRole('button', { name: /Support kontaktieren/i }).count()) > 0, 'Support: "Support kontaktieren"-Button');
  await shot(page, 'support-02-support-tab');

  // Contact button opens the drawer
  await page.getByRole('button', { name: /Support kontaktieren/i }).first().click();
  await page.waitForTimeout(700);
  ok((await page.getByText(/Anliegen|Betreff|Nachricht|Abteilung/i).count()) > 0, 'Kontakt-Drawer öffnet');
  await shot(page, 'support-03-contact-drawer');

} catch (e) {
  console.log('\n💥 ERROR:', e.message);
  await shot(page, 'support-error').catch(() => {});
  failures++;
} finally {
  await browser.close();
  console.log(`\n${failures === 0 ? '✅ PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}
