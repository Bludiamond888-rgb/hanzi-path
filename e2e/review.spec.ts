import { test, expect, type Page } from '@playwright/test';
import strokes from '../src/data/strokes.json' with { type: 'json' };
const S = strokes as Record<string, { medians: number[][][] }>;

// iPhone 16 Pro Max: 440×956 CSS px @3x
test.use({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

async function pts(page: Page, char: string, i: number) {
  const box = (await page.getByTestId('writer').boundingBox())!;
  const size = box.width, pad = size * 0.08, sc = (size - 2 * pad) / 1024;
  return S[char].medians[i].map(([x, y]) => ({ x: box.x + pad + x * sc, y: box.y + size - pad - (y + 124) * sc }));
}
async function drawStroke(page: Page, char: string, i: number, opts: { wrong?: boolean; holdShot?: string } = {}) {
  const box = (await page.getByTestId('writer').boundingBox())!;
  let p = await pts(page, char, i);
  if (opts.wrong) p = [{ x: box.x + box.width * 0.85, y: box.y + box.height * 0.9 }, { x: box.x + box.width * 0.15, y: box.y + box.height * 0.1 }];
  await page.mouse.move(p[0].x, p[0].y); await page.mouse.down();
  const segs: [number, number][] = [];
  for (let k = 1; k < p.length; k++) for (let t = 1; t <= 6; t++) segs.push([k, t]);
  for (let s = 0; s < segs.length; s++) {
    const [k, t] = segs[s], a = p[k - 1], b = p[k];
    await page.mouse.move(a.x + (b.x - a.x) * t / 6, a.y + (b.y - a.y) * t / 6);
    if (opts.holdShot && s === Math.floor(segs.length * 0.6)) await page.screenshot({ path: opts.holdShot });
  }
  await page.mouse.up(); await page.waitForTimeout(350);
}

test('cards tab: prompt → write → reveal + suggested grade → grade; settings; practice unchanged', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.tabs')).toBeVisible(); await page.waitForTimeout(300); // let mount-time saves settle before seeding
  await page.evaluate(() => {
    localStorage.clear();
    const d = new Date(), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // one card already due (seeded test data) so the queue starts with a multi-stroke character
    localStorage.setItem('hanzi-path-cards-v1', JSON.stringify({ v: 1, cards: { '你': { ef: 2.5, ivl: 3, reps: 2, due: k, lapses: 0, seen: k } }, log: {}, newLog: {}, settings: { newPerDay: 10, mode: 'meaning', autoSpeak: false, writeFirst: true } }));
  });
  await page.reload();
  // header/tab bar are solid and fixed
  const top = await page.locator('.top').evaluate(e => { const c = getComputedStyle(e); return [c.position, c.backdropFilter || (c as any).webkitBackdropFilter, c.backgroundColor]; });
  expect(top[0]).toBe('fixed'); expect(top[1] === 'none' || !top[1]).toBeTruthy();

  await page.getByTestId('tab-cards').click();
  await expect(page.getByTestId('due-count')).toHaveText('1');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screens/review-home.png' });

  await page.getByTestId('start').click();
  const pad = page.getByTestId('write-pad');
  await expect(pad).toBeVisible();
  await expect(page.getByTestId('grades')).toHaveCount(0); // no grading before writing
  const c = (await pad.getAttribute('data-char'))!;
  expect(c).toBe('你');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screens/review-prompt.png' });

  // page must not scroll while drawing
  const y0 = await page.evaluate(() => scrollY);
  await drawStroke(page, c, 0, { wrong: true });
  const n = S[c].medians.length;
  for (let i = 0; i < n; i++) await drawStroke(page, c, i, i === 3 ? { holdShot: 'screens/review-writing.png' } : {});
  expect(await page.evaluate(() => scrollY)).toBe(y0);

  await expect(page.getByTestId('answer')).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('write-summary')).toContainText('1 mistake');
  await expect(page.getByTestId('grade-hard')).toHaveClass(/sug/);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screens/review-reveal.png' });
  await page.getByTestId('grade-good').click();

  // next (new) card: skip writing → grades appear without a suggestion
  await expect(page.getByTestId('write-pad')).toBeVisible();
  await page.getByTestId('skip-writing').click();
  await expect(page.getByTestId('grades')).toBeVisible();
  await expect(page.getByTestId('suggested')).toHaveCount(0);
  await page.getByTestId('grade-again').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hanzi-path-cards-v1')!));
  expect(saved.cards['你'].reps).toBe(3); expect(Object.keys(saved.cards)).toHaveLength(2);

  // settings
  await page.locator('.fc-prog .x').click();
  await page.getByTestId('fc-settings').click();
  await expect(page.getByTestId('write-first')).toBeChecked();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'screens/review-settings.png' });

  // 字 → meaning: reveal first, then write (copy) the shown character before grading
  await page.getByText('字 → meaning').click();
  await page.getByTestId('fc-study').click(); await page.getByTestId('start').click();
  await expect(page.getByTestId('write-pad')).toHaveCount(0);
  await page.getByTestId('show').click();
  await expect(page.getByTestId('write-pad')).toBeVisible();
  await expect(page.getByTestId('grades')).toHaveCount(0);
  await page.waitForTimeout(300); await page.screenshot({ path: 'screens/review-hanzi-mode-write.png' });
  await page.getByTestId('skip-writing').click();
  await expect(page.getByTestId('grades')).toBeVisible();
  await page.locator('.fc-prog .x').click(); await page.getByTestId('fc-settings').click();
  // writing off → classic flip-and-grade
  await page.getByTestId('write-first').click();
  await page.getByTestId('fc-study').click(); await page.getByTestId('start').click();
  await expect(page.getByTestId('write-pad')).toHaveCount(0);
  await page.getByTestId('show').click();
  await expect(page.getByTestId('grades')).toBeVisible();

  // practice tab unchanged
  await page.getByTestId('tab-path').click();
  await expect(page.getByText('第一章')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screens/review-practice.png' });
  await page.getByTestId('lesson-0').click();
  await expect(page.getByTestId('continue')).toBeEnabled({ timeout: 20000 });
  await page.getByTestId('continue').click(); await page.waitForTimeout(500);
  await page.screenshot({ path: 'screens/review-practice-lesson.png' });
});
