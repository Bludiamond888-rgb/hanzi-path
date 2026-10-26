import { test, expect } from '@playwright/test';

test('components: More → list → detail → quiz → write', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText('第一章')).toBeVisible();

  await page.getByTestId('tab-more').click();
  await expect(page.getByTestId('parts-entry')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screens/11-more-components.png' });

  await page.getByTestId('open-parts').click();
  await expect(page.getByTestId('parts')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screens/12-components-list.png' });

  await page.getByTestId('part-nv').click();
  await expect(page.getByTestId('part-detail')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screens/13-component-detail.png' });

  await page.getByTestId('part-quiz').click();
  await expect(page.getByTestId('part-quiz-view')).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'screens/14-component-quiz.png' });
  await page.getByTestId('choice-nv').click();
  await expect(page.getByTestId('part-quiz-fb')).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'screens/15-component-quiz-ok.png' });
  await page.getByTestId('part-quiz-continue').click();

  await page.getByTestId('part-write').click();
  await expect(page.getByTestId('part-write-view')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'screens/16-component-write.png' });
  await page.getByTestId('part-write-ready').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screens/17-component-write-quiz.png' });
});
