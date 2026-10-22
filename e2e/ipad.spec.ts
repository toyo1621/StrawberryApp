import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const expectNoHorizontalOverflow = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
};

test('iPad rotation and narrow windows retain the player, island region, and accessible controls', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByLabel('プレイヤー名', { exact: true }).fill('iPadテスト');
  await page.getByRole('button', { name: '島モードを選択' }).click();
  const region = page.getByRole('button', { name: '九州南部を出題エリアに選択、59島' });
  await region.click();
  for (const viewport of [
    { width: 834, height: 1194 },
    { width: 1194, height: 834 },
    { width: 1366, height: 1024 },
    { width: 375, height: 768 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByLabel('プレイヤー名', { exact: true })).toHaveValue('iPadテスト');
    await expect(region).toHaveAttribute('aria-pressed', 'true');
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: '島モードでゲームを開始' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`home-${viewport.width}.png`), fullPage: true });
  }
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('all four games keep their score and running timer when an iPad rotates or changes window width', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const mode of ['いちご', '島', '国旗', '色']) {
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.goto('/');
    await page.getByLabel('プレイヤー名', { exact: true }).fill('iPadテスト');
    await page.getByRole('button', { name: `${mode}モードを選択` }).click();
    await page.getByRole('button', { name: `${mode}モードでゲームを開始` }).click();
    const choices = page.getByRole('button', { name: /選択肢[12]、/ });
    await expect(choices).toHaveCount(2);
    await expect.poll(async () => Number((await page.getByTestId('game-time').textContent())?.replace('時間: ', ''))).toBeLessThan(29);
    const score = await page.getByTestId('game-score').textContent();
    const time = Number((await page.getByTestId('game-time').textContent())?.replace('時間: ', ''));
    for (const viewport of [{ width: 1194, height: 834 }, { width: 375, height: 768 }]) {
      await page.setViewportSize(viewport);
      await expect(page.getByTestId('game-score')).toHaveText(score ?? '');
      expect(Number((await page.getByTestId('game-time').textContent())?.replace('時間: ', ''))).toBeLessThanOrEqual(time);
      for (const choice of await choices.all()) {
        await choice.scrollIntoViewIfNeeded();
        const box = await choice.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        expect(box!.width).toBeGreaterThanOrEqual(100);
      }
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`${mode}-${viewport.width}.png`), fullPage: true });
    }
    await choices.first().click();
    await expect(page.getByRole('progressbar', { name: '残り時間' })).toBeVisible();
    await page.getByRole('button', { name: 'ゲームをやめてホームに戻る' }).click();
    await expect(page.getByRole('button', { name: `${mode}モードでゲームを開始` })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
