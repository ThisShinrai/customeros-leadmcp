// Smoke test: tasks Board v2 — agency custom columns, cards = real tasks,
// un-clipped settings modal, add/rename/delete column.
import { launch, loginAgency } from './helpers.mjs';
import { BASE } from './helpers.mjs';

let fails = 0;
const errors = [];
function log(ok, msg) { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) { fails++; process.exitCode = 1; } }

const { browser, page } = await launch();
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

try {
  console.log('▶ Login → /app/a/tasks → Board');
  await loginAgency(page);
  await page.goto(`${BASE}/app/a/tasks`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Board' }).click();
  await page.waitForTimeout(500);

  // "Meine Boards" tab must be gone.
  log(!(await page.getByRole('button', { name: 'Meine Boards' }).isVisible().catch(() => false)), '"Meine Boards" tab removed');

  // Default columns rendered (scope to the board to avoid the status-filter options).
  const board = page.locator('.tk-scroll');
  for (const c of ['Zu erledigen', 'In Arbeit', 'In Review', 'Erledigt']) {
    log(await board.getByText(c, { exact: true }).first().isVisible().catch(() => false), `column "${c}" rendered`);
  }

  // At least one real task card present (seed data has tasks).
  const cardCount = await page.locator('.tk-card').count();
  log(cardCount > 0, `task cards visible on board (${cardCount})`);

  console.log('▶ Column settings modal (must NOT be clipped)');
  await page.getByLabel('Spalte bearbeiten').first().click();
  await page.waitForTimeout(300);
  const modalVisible = await page.getByText('Spalte bearbeiten').first().isVisible();
  log(modalVisible, 'settings modal opened');
  // The modal title should be fully within the viewport (not clipped by the board).
  const box = await page.getByRole('heading', { name: 'Spalte bearbeiten' }).boundingBox().catch(() => null);
  const vp = page.viewportSize();
  log(!!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width, `modal within viewport (not clipped): ${box ? `${Math.round(box.x)},${Math.round(box.y)}` : 'none'}`);
  await page.getByRole('button', { name: 'Abbrechen' }).first().click();
  await page.waitForTimeout(200);

  console.log('▶ Add a column');
  await page.getByRole('button', { name: 'Spalte', exact: true }).click();
  const colInput = page.getByPlaceholder('Spalten-Name…');
  await colInput.waitFor({ timeout: 4000 });
  await colInput.fill('QA Spalte');
  await colInput.press('Enter');
  await page.getByText('QA Spalte', { exact: true }).first().waitFor({ timeout: 8000 });
  log(await page.getByText('QA Spalte', { exact: true }).first().isVisible(), 'new column "QA Spalte" created');

  console.log('▶ Delete the QA column (cleanup)');
  // open the QA column's settings (last column's edit button)
  const editBtns = page.getByLabel('Spalte bearbeiten');
  await editBtns.last().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Spalte löschen' }).click();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await page.waitForTimeout(800);
  log(!(await page.getByText('QA Spalte', { exact: true }).first().isVisible().catch(() => false)), 'QA column deleted');

  console.log('\n▶ Browser errors:', errors.length);
  errors.slice(0, 6).forEach((e) => console.log('   [err]', e));
  log(errors.length === 0, 'no uncaught browser errors');

  console.log(fails === 0 ? '\n✅ ALL TASK-BOARD CHECKS PASSED' : `\n❌ ${fails} CHECK(S) FAILED`);
} catch (e) {
  console.log('  💥 fatal:', String(e).slice(0, 300));
  await page.screenshot({ path: 'e2e/shots/taskboard-FATAL.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
