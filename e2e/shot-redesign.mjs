import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errs.push(m.text().slice(0, 120)); });
page.on('pageerror', (e) => errs.push('PE: ' + String(e).slice(0, 120)));

try {
  await loginAgency(page);
  console.log('Dashboard…');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, 'rd-01-dashboard');

  console.log('Create-project drawer…');
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Neues Projekt|Erstes Projekt/ }).first().click();
  await page.waitForTimeout(700);
  await shot(page, 'rd-02-drawer');

  console.log('Invite-client drawer…');
  await page.goto(`${BASE}/clients`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Kunde einladen|Ersten Kunden/ }).first().click();
  await page.waitForTimeout(700);
  await shot(page, 'rd-03-client-drawer');

  console.log('console errors:', errs.length ? errs.slice(0, 6) : 'none');
} catch (e) {
  console.log('ERROR:', e.message);
  await shot(page, 'rd-error').catch(() => {});
} finally {
  await browser.close();
}
