import { test, expect, type Page } from '@playwright/test';
import strokes from '../src/data/strokes.json' with { type: 'json' };
const S = strokes as Record<string, { medians: number[][][] }>;

/** draw a stroke along the hanzi-writer median, mapped to screen coordinates */
async function drawStroke(page: Page, char: string, i: number, wrong = false) {
  const box = (await page.getByTestId('writer').boundingBox())!;
  const size = box.width, pad = size * 0.08, sc = (size - 2 * pad) / 1024;
  let pts = S[char].medians[i].map(([x, y]) => ({ x: box.x + pad + x * sc, y: box.y + size - pad - (y + 124) * sc }));
  if (wrong) pts = [{ x: box.x + size * 0.85, y: box.y + size * 0.9 }, { x: box.x + size * 0.15, y: box.y + size * 0.1 }];
  await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k];
    for (let t = 1; t <= 4; t++) await page.mouse.move(a.x + (b.x - a.x) * t / 4, a.y + (b.y - a.y) * t / 4);
  }
  await page.mouse.up(); await page.waitForTimeout(350);
}
async function currentChar(page: Page) {
  return (await page.locator('.ex-w .hl').first().textContent())!;
}
async function writeChar(page: Page, shot?: string, wrongFirst = 0) {
  const c = await currentChar(page);
  for (let w = 0; w < wrongFirst; w++) await drawStroke(page, c, 0, true);
  const n = S[c].medians.length;
  for (let i = 0; i < n; i++) {
    await drawStroke(page, c, i);
    if (shot && i === Math.floor((n - 1) / 2)) await page.screenshot({ path: shot });
  }
  await expect(page.getByTestId('feedback')).toBeVisible({ timeout: 5000 });
}

test('map → lesson (watch/trace/quiz) → complete → review', async ({ page }) => {
  await page.goto('./'); await page.evaluate(() => localStorage.clear()); await page.reload();
  await expect(page.getByText('UNIT 1')).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screens/01-map.png' });
  await page.getByTestId('lesson-0').click();
  for (let ci = 0; ci < 5; ci++) {
    // watch
    if (ci === 0) { await page.waitForTimeout(700); await page.screenshot({ path: 'screens/02-watch.png' }); }
    await expect(page.getByTestId('continue')).toBeEnabled({ timeout: 20000 });
    await page.getByTestId('continue').click();
    // trace
    await writeChar(page, ci === 1 ? 'screens/03-trace.png' : undefined, ci === 1 ? 2 : 0);
    await page.getByTestId('continue').click();
    // quiz
    await writeChar(page, ci === 2 ? 'screens/04-quiz.png' : undefined, ci === 0 ? 3 : 0);
    if (ci === 0) { await page.waitForTimeout(600); await page.screenshot({ path: 'screens/05-correct.png' }); }
    await page.getByTestId('continue').click();
  }
  await expect(page.getByTestId('done')).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'screens/06-complete.png' });
  const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('hanzi-path-progress-v1')!));
  expect(prog.lessons.L1).toBeGreaterThanOrEqual(1); expect(prog.streak).toBe(1); expect(Object.keys(prog.chars)).toHaveLength(5);
  await page.waitForTimeout(1500); await page.screenshot({ path: 'screens/06b-complete-settled.png' });
  await page.getByText('Back to path').click();
  await expect(page.getByTestId('lesson-1')).toBeEnabled();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screens/07-map-after.png' });
  // review (weak char from 3 deliberate mistakes)
  await page.locator('.btn.review').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screens/08-review.png' });
  await page.locator('.x').click();
  await page.getByText('Chars').click(); await page.locator('.cell').nth(3).click(); await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screens/09-chars.png' });
  await page.getByText('More').click(); await page.waitForTimeout(200);
  await page.screenshot({ path: 'screens/10-about.png', fullPage: true });
});
