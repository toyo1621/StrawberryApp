import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('home and policy screens have no detectable accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'いちごつめ！' })).toBeVisible();

  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('main')).toBeVisible();
  const homeResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(homeResults.violations).toEqual([]);

  await page.getByRole('button', { name: 'マイページを開く' }).click();
  await page.getByRole('button', { name: 'プライバシーポリシーを開く' }).click();
  await expect(page.getByRole('heading', { name: 'プライバシーポリシー' })).toBeVisible();

  const policyResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(policyResults.violations).toEqual([]);
});

test('a player can start and answer every mode without page errors or external flag requests', async ({ page }) => {
  const externalFlagRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('cdn.jsdelivr.net')) {
      externalFlagRequests.push(request.url());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const modes = [
    { label: 'いちご', title: 'いちごつめ！' },
    { label: '島', title: '島つめ！' },
    { label: '国旗', title: '国旗つめ！' },
    { label: '色', title: '色つめ！' },
  ];

  for (const mode of modes) {
    await page.goto('/');
    await page.getByLabel('プレイヤー名').fill('E2Eプレイヤー');
    await page.getByRole('button', { name: `${mode.label}モードを選択` }).click();
    await page.getByRole('button', { name: `${mode.label}モードでゲームを開始` }).click();

    const choices = page.getByRole('button', { name: /選択肢[12]、/ });
    await expect(choices).toHaveCount(2);
    await choices.first().click();
    await page.getByRole('button', { name: 'ゲームをやめてホームに戻る' }).click();
    await expect(page.getByRole('heading', { name: mode.title })).toBeVisible();
  }

  expect(externalFlagRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('settings and all-mode score history are reachable', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('プレイヤー名').fill('設定テスト');
  await page.getByRole('button', { name: 'マイページを開く' }).click();

  await page.getByRole('button', { name: '設定を開く' }).click();
  const darkMode = page.getByLabel('ダークモード');
  await darkMode.click();
  await expect(darkMode).toBeChecked();
  await page.getByRole('button', { name: '前の画面に戻る' }).click();

  await page.getByRole('button', { name: 'マイページを開く' }).click();
  await page.getByRole('button', { name: '色モードを選択' }).click();
  await expect(page.getByRole('button', { name: '色モードのスコア履歴を表示' })).toBeVisible();
});
