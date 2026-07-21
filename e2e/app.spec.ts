import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('home and policy screens have no detectable accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'いちごつめ！' })).toBeVisible();

  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('tab', { name: '全体ランキング' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'いちごモードを選択' })).toHaveAttribute('aria-pressed', 'true');
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
    await expect(page.getByRole('button', { name: `${mode.label}モードを選択` })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: `${mode.label}モードでゲームを開始` }).click();

    const choices = page.getByRole('button', { name: /選択肢[12]、/ });
    await expect(choices).toHaveCount(2);
    await choices.first().click();
    const exitButton = page.getByRole('button', { name: 'ゲームをやめてホームに戻る' });
    const exitBox = await exitButton.boundingBox();
    expect(exitBox?.height).toBeGreaterThanOrEqual(44);
    await exitButton.click();
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
  const darkResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(darkResults.violations).toEqual([]);
  await page.getByRole('button', { name: '前の画面に戻る' }).click();

  await page.getByRole('button', { name: 'マイページを開く' }).click();
  await page.getByRole('button', { name: '色モードを選択' }).click();
  await expect(page.getByRole('button', { name: '色モードのスコア履歴を表示' })).toBeVisible();
  const darkMyPageResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(darkMyPageResults.violations).toEqual([]);

  await page.getByRole('button', { name: 'プレイヤーデータの削除確認を開く' }).click();
  await expect(page.getByRole('alert')).toContainText('この操作は元に戻せません');
  const deleteButton = page.getByRole('button', { name: 'すべてのプレイヤーデータを削除' });
  const deleteBox = await deleteButton.boundingBox();
  expect(deleteBox?.height).toBeGreaterThanOrEqual(44);

  await page.getByRole('button', { name: 'データ削除をキャンセル' }).click();
  await page.getByRole('button', { name: 'ホームに戻る' }).click();
  await page.getByLabel('プレイヤー名').fill('ダークテスト');
  await page.getByRole('button', { name: '色モードを選択' }).click();
  await page.getByRole('button', { name: '色モードでゲームを開始' }).click();
  const darkGameResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(darkGameResults.violations).toEqual([]);
});

test('incorrect answers provide visible and assertive text feedback', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('プレイヤー名').fill('通知テスト');
  await page.getByRole('button', { name: '国旗モードを選択' }).click();
  await page.getByRole('button', { name: '国旗モードでゲームを開始' }).click();

  const incorrectMessage = page.getByText('不正解。残り時間が3秒減りました。');
  for (let attempt = 0; attempt < 12 && !await incorrectMessage.isVisible(); attempt += 1) {
    await page.getByRole('button', { name: /選択肢[12]、/ }).first().click();
    if (!await incorrectMessage.isVisible()) {
      await page.waitForTimeout(350);
    }
  }

  await expect(incorrectMessage).toBeVisible();
  await expect(incorrectMessage).toHaveAttribute('aria-live', 'assertive');
});

test('home stays within layout and script performance budgets', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'いちごつめ！' })).toBeVisible();

  const metrics = await page.evaluate(() => {
    const scripts = performance.getEntriesByType('resource')
      .filter((entry) => entry.name.includes('.js')) as PerformanceResourceTiming[];
    return {
      encodedScriptBytes: scripts.reduce((total, entry) => total + entry.encodedBodySize, 0),
      navigationMs: performance.getEntriesByType('navigation')[0]?.duration ?? Number.POSITIVE_INFINITY,
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });

  expect(metrics.encodedScriptBytes).toBeLessThan(900_000);
  expect(metrics.navigationMs).toBeLessThan(5_000);
  expect(metrics.hasHorizontalOverflow).toBe(false);
});

test('a player can erase device-owned data from the app', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('プレイヤー名').fill('削除テスト');
  await page.getByRole('button', { name: 'いちごモードでゲームを開始' }).click();
  await page.getByRole('button', { name: 'ゲームをやめてホームに戻る' }).click();
  await page.getByRole('button', { name: 'マイページを開く' }).click();
  await page.getByRole('button', { name: 'プレイヤーデータの削除確認を開く' }).click();
  await page.getByRole('button', { name: 'すべてのプレイヤーデータを削除' }).click();

  await expect(page.getByRole('heading', { name: 'いちごつめ！' })).toBeVisible();
  await expect(page.getByText('0件の公開スコアと、この端末に保存したデータを削除しました。')).toBeVisible();
  await expect(page.getByLabel('プレイヤー名')).toHaveValue('');
});
