import { launch, loginAgency, shot, BASE } from './helpers.mjs';

const { browser, page } = await launch();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errs.push(m.text().slice(0, 100)); });
page.on('pageerror', (e) => errs.push('PE:' + String(e).slice(0, 100)));

try {
  await loginAgency(page);
  const pages = [
    ['/dashboard', 'ap-dashboard'],
    ['/projects', 'ap-projects'],
    ['/clients', 'ap-clients'],
    ['/invoices', 'ap-invoices'],
    ['/team', 'ap-team'],
    ['/settings', 'ap-settings'],
  ];
  for (const [path, name] of pages) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await shot(page, name);
  }
  // project detail
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
  await page.locator('a[href^="/projects/"]').first().click();
  await page.waitForURL(/\/projects\/[A-Za-z0-9_-]+$/);
  await page.waitForTimeout(700);
  await shot(page, 'ap-detail');

  console.log('console errors:', errs.length ? errs.slice(0, 8) : 'none');
} catch (e) {
  console.log('ERROR:', e.message);
} finally {
  await browser.close();
}
