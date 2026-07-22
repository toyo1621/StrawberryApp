import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const expectNoAccessibilityViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
};

test('home and policy screens have no detectable accessibility violations', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('strawberry_game_rankings', JSON.stringify([{
      id: 'e2e-ranking-entry',
      playerName: 'ランキングテスト',
      score: 12,
      gameType: 'strawberry_rush',
      createdAt: '2026-07-20T00:00:00.000Z',
    }]));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'いちごつめ！' })).toBeVisible();
  await expect(page.getByText('ランキングテスト')).toBeVisible();

  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('tab', { name: '全体ランキング' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'いちごモードを選択' })).toHaveAttribute('aria-pressed', 'true');
  await expectNoAccessibilityViolations(page);

  await page.getByRole('button', { name: 'ルールを開く' }).click();
  await expect(page.getByRole('heading', { name: 'ゲームルール' })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.getByRole('button', { name: '前の画面に戻る' }).click();

  await page.getByRole('button', { name: 'マイページを開く' }).click();
  await page.getByRole('button', { name: 'プライバシーポリシーを開く' }).click();
  await expect(page.getByRole('heading', { name: 'プライバシーポリシー' })).toBeVisible();

  await expectNoAccessibilityViolations(page);

  await page.getByRole('button', { name: '前の画面に戻る' }).click();
  await page.getByRole('button', { name: 'マイページを開く' }).click();
  await page.getByRole('button', { name: '利用規約を開く' }).click();
  await expect(page.getByRole('heading', { name: '利用規約' })).toBeVisible();
  await expectNoAccessibilityViolations(page);
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
    await expectNoAccessibilityViolations(page);
    expect(await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )).toBe(false);
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

test('island mode filters all 415 islands by the selected area', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '島モードを選択' }).click();

  const nationwide = page.getByRole('button', { name: '日本全国を出題エリアに選択、415島' });
  const chugoku = page.getByRole('button', { name: '中国を出題エリアに選択、89島' });
  const shikoku = page.getByRole('button', { name: '四国を出題エリアに選択、72島' });
  const okinawa = page.getByRole('button', { name: '沖縄を出題エリアに選択、46島' });
  await expect(nationwide).toHaveAttribute('aria-pressed', 'true');
  await expect(chugoku).toHaveAttribute('aria-pressed', 'false');
  await expect(shikoku).toHaveAttribute('aria-pressed', 'false');
  await expect(okinawa).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(
    () => performance.getEntriesByType('resource').filter((entry) => entry.name.includes('.svg')).length,
  )).toBe(0);

  await okinawa.click();
  await expect(okinawa).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('プレイヤー名').fill('島地域テスト');
  await page.getByRole('button', { name: '島モードでゲームを開始' }).click();

  await expect(page.getByText('沖縄・46島')).toBeVisible();
  await expect(page.getByText(/（沖縄県）/)).toBeVisible();
  const choices = page.getByRole('button', { name: /選択肢[12]、/ });
  await expect(choices).toHaveCount(2);
  for (const choice of await choices.all()) {
    const image = choice.locator('img');
    await expect(image).toHaveCount(1);
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  }
  expect(await page.evaluate(
    () => performance.getEntriesByType('resource').filter((entry) => entry.name.includes('.svg')).length,
  )).toBe(2);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test('island rankings follow the selected nationwide, Chugoku, and Shikoku scope', async ({ page }) => {
  await page.addInitScript(() => {
    const entry = (id: string, playerName: string, score: number, islandRegion: string) => ({
      id,
      playerName,
      score,
      gameType: 'island_rush',
      islandRegion,
      createdAt: '2026-07-21T00:00:00.000Z',
    });
    window.localStorage.setItem(
      'island_game_rankings',
      JSON.stringify([entry('island-all', '全国ランキング選手', 10, 'all')]),
    );
    window.localStorage.setItem(
      'island_game_rankings_chugoku',
      JSON.stringify([entry('island-chugoku', '中国ランキング選手', 8, 'chugoku')]),
    );
    window.localStorage.setItem(
      'island_game_rankings_shikoku',
      JSON.stringify([entry('island-shikoku', '四国ランキング選手', 6, 'shikoku')]),
    );
  });

  await page.goto('/');
  await page.getByRole('button', { name: '島モードを選択' }).click();
  await expect(page.getByRole('heading', { name: '日本全国ランキング' })).toBeVisible();
  await expect(page.getByText('全国ランキング選手')).toBeVisible();

  await page.getByRole('button', { name: '中国を出題エリアに選択、89島' }).click();
  await expect(page.getByRole('heading', { name: '中国ランキング' })).toBeVisible();
  await expect(page.getByText('中国ランキング選手')).toBeVisible();
  await expect(page.getByText('全国ランキング選手')).toHaveCount(0);

  await page.getByRole('button', { name: '四国を出題エリアに選択、72島' }).click();
  await expect(page.getByRole('heading', { name: '四国ランキング' })).toBeVisible();
  await expect(page.getByText('四国ランキング選手')).toBeVisible();
  await expect(page.getByText('中国ランキング選手')).toHaveCount(0);
});

test('settings and all-mode score history are reachable', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('プレイヤー名').fill('設定テスト');
  await page.getByRole('button', { name: 'マイページを開く' }).click();

  await page.getByRole('button', { name: '設定を開く' }).click();
  const darkMode = page.getByLabel('ダークモード');
  await darkMode.click();
  await expect(darkMode).toBeChecked();
  await expectNoAccessibilityViolations(page);
  await page.getByRole('button', { name: '前の画面に戻る' }).click();

  await page.getByRole('button', { name: 'マイページを開く' }).click();
  await page.getByRole('button', { name: '色モードを選択' }).click();
  await expect(page.getByRole('button', { name: '色モードのスコア履歴を表示' })).toBeVisible();
  await expectNoAccessibilityViolations(page);

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
  await expectNoAccessibilityViolations(page);
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
