// Smoke test: custom Kanban boards (Meine Boards) — create board, seeded lists,
// add card, set border colour, and last-view + active-board persistence.
import { launch, loginAgency, shot } from './helpers.mjs';
import { BASE } from './helpers.mjs';

let fails = 0;
const errors = [];
function log(ok, msg) { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) { fails++; process.exitCode = 1; } }

const { browser, page } = await launch();
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

try {
  console.log('▶ Login');
  await loginAgency(page);
  log(/\/dashboard/.test(page.url()), 'logged in');

  console.log('▶ Open /app/a/tasks → Meine Boards');
  await page.goto(`${BASE}/app/a/tasks`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Meine Boards' }).click();
  await page.waitForTimeout(400);
  const newBoardBtn = page.getByRole('button', { name: 'Neues Board' });
  log(await newBoardBtn.isVisible(), '"Meine Boards" view active (Neues Board button visible)');
  // groupBy + filters + "Neue Aufgabe" must be hidden here
  log(!(await page.getByRole('button', { name: 'Neue Aufgabe' }).isVisible().catch(() => false)),
    '"Neue Aufgabe" hidden in boards view');

  console.log('▶ Create board (inline input → createBoard + seeded lists)');
  await newBoardBtn.click();
  const nameInput = page.getByPlaceholder('Board-Name…');
  await nameInput.waitFor({ timeout: 4000 });
  await nameInput.fill('QA Smoke Board');
  await nameInput.press('Enter');
  // three default lists seeded by the server action
  await page.getByText('Zu erledigen').first().waitFor({ timeout: 8000 });
  log(await page.getByText('Zu erledigen').first().isVisible(), 'seeded list "Zu erledigen" rendered');
  log(await page.getByText('In Arbeit').first().isVisible(), 'seeded list "In Arbeit" rendered');
  log(await page.getByText('Erledigt').first().isVisible(), 'seeded list "Erledigt" rendered');
  log(await page.getByText('QA Smoke Board').first().isVisible(), 'board name shown');
  await shot(page, 'boards-1-created');

  console.log('▶ Add a card (createCard)');
  await page.getByRole('button', { name: 'Karte' }).first().click();
  const cardInput = page.getByPlaceholder('Karten-Titel…');
  await cardInput.waitFor({ timeout: 4000 });
  await cardInput.fill('Meine erste Karte');
  await page.getByRole('button', { name: 'Hinzufügen' }).first().click();
  await page.getByText('Meine erste Karte').first().waitFor({ timeout: 8000 });
  log(await page.getByText('Meine erste Karte').first().isVisible(), 'card persisted + rendered');
  await shot(page, 'boards-2-card');

  console.log('▶ Set border colour (updateBoard)');
  await page.getByLabel('Board-Einstellungen').click();
  await page.waitForTimeout(250);
  await page.getByLabel('#EF4444').click();           // red
  await page.waitForTimeout(500);
  // close the settings dropdown
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(5, 400).catch(() => {});
  await page.waitForTimeout(300);
  const borderC = await page.evaluate(() => {
    // climb from the settings button up to the board container (border-radius 18px)
    let el = document.querySelector('[aria-label="Board-Einstellungen"]');
    while (el && getComputedStyle(el).borderRadius !== '18px') el = el.parentElement;
    return el ? getComputedStyle(el).borderColor : null;
  });
  log(borderC === 'rgb(239, 68, 68)', `board border colour applied (got ${borderC})`);
  await shot(page, 'boards-3-color');

  console.log('▶ Persistence: leave /tasks → return → view + active board restored');
  await page.goto(`${BASE}/app/a/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/app/a/tasks`, { waitUntil: 'networkidle' });
  // should auto-restore to boards view AND auto-load the active board's lists
  const restored = await page.getByText('Zu erledigen').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  log(restored, 'last view (boards) + active board restored after navigation');
  log(await page.getByText('Meine erste Karte').first().isVisible().catch(() => false), 'card still present after reload (DB persistence)');
  await shot(page, 'boards-4-persisted');

  console.log('▶ Cleanup: delete the QA board (ConfirmDialog)');
  await page.getByLabel('Board-Einstellungen').click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Board löschen' }).click();
  await page.getByRole('button', { name: 'Board löschen' }).click(); // ConfirmDialog confirm
  await page.waitForTimeout(800);
  log(!(await page.getByText('QA Smoke Board').first().isVisible().catch(() => false)), 'board deleted via ConfirmDialog');

  console.log('\n▶ Browser errors during run:', errors.length);
  errors.slice(0, 8).forEach((e) => console.log('   [err]', e));
  log(errors.length === 0, 'no uncaught browser errors');

  console.log(fails === 0 ? '\n✅ ALL BOARD SMOKE CHECKS PASSED' : `\n❌ ${fails} CHECK(S) FAILED`);
} catch (e) {
  console.log('  💥 fatal:', String(e).slice(0, 300));
  await shot(page, 'boards-FATAL').catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
