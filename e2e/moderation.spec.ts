import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const API = 'http://127.0.0.1:43999';
const block = { id: '11111111-1111-4111-8111-111111111111', rankingId: 'target-score', playerName: '確認対象', createdAt: '2026-10-23T00:00:00.000Z' };

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.error(`Browser exception: ${error.message}`));
  page.on('console', (message) => {if (message.type() === 'error') {console.error(`Browser console: ${message.text()}`);}});
  page.on('requestfailed', (request) => console.error(`Browser request failed: ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`));
});

const mockApi = async (page: Page) => {
  const state = { blocked: false, failReports: false, sessionRejection: 'NAME_NOT_ALLOWED', scoreRequests: 0, reports: [] as Record<string, unknown>[], authorization: [] as string[] };
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') {await route.fulfill({ status: 204, headers }); return;}
    state.authorization.push(request.headers().authorization ?? '');
    let body: unknown = [];
    let status = 200;
    if (path === '/rankings') {
      const gameType = new URL(request.url()).searchParams.get('gameType');
      const entry = (id: string, playerName: string, score: number, isCurrentPlayer = false) => ({ id, playerName, score, gameType, islandRegion: 'all', createdAt: block.createdAt, publicRank: id === 'target-score' ? 1 : id === 'namesake-score' ? 2 : 3, ...(isCurrentPlayer ? { isCurrentPlayer } : {}) });
      body = [
        ...state.blocked ? [] : [entry('target-score', '確認対象', 100)],
        entry('namesake-score', '確認対象', 50),
        entry('my-score', '本人の記録', 10, true),
      ];
    } else if (path === '/game-sessions') {
      status = state.sessionRejection === 'NAME_NOT_ALLOWED' ? 400 : 403;
      body = { code: state.sessionRejection, error: '名前または公開ランキングへの参加を確認してください。' };
    } else if (path === '/scores') {state.scoreRequests += 1;
    } else if (path === '/ranking-reports') {
      state.reports.push(request.postDataJSON() as Record<string, unknown>);
      status = state.failReports ? 503 : 200;
      body = state.failReports ? { error: 'temporarily unavailable' } : { id: 'receipt', status: 'received' };
    } else if (path === '/players/me/blocks') {
      if (request.method() === 'POST') {state.blocked = true;}
      if (request.method() === 'DELETE') {state.blocked = false;}
      body = state.blocked ? [block] : [];
    } else if (path === '/players/me/best') {body = { score: 10 };}
    await route.fulfill({ status, headers, body: JSON.stringify(body) });
  });
  return state;
};

const assertAccessible = async (page: Page) => {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
};

test('report, block, restart, and unblock preserve namesakes and private data at desktop, 320px, and iPad sizes', async ({ page }, testInfo) => {
  const state = await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '確認対象の通報・ブロック' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: '本人の記録の通報・ブロック' })).toHaveCount(0);
  await page.getByRole('button', { name: '確認対象の通報・ブロック' }).first().click();
  await page.getByRole('button', { name: '名前を通報', exact: true }).click();
  await page.getByRole('radio', { name: '個人情報が含まれている' }).click();
  await assertAccessible(page);
  await page.screenshot({ path: testInfo.outputPath('report-dialog.png'), fullPage: true });
  await page.getByRole('button', { name: '通報を送信' }).click();
  await expect(page.getByText('通報を受け付けました。運営が確認します。')).toBeVisible();
  expect(state.reports).toEqual([{ rankingId: 'target-score', reason: 'personal_information' }]);
  await page.getByRole('button', { name: 'このプレイヤーをブロック' }).click();
  await expect(page.getByRole('button', { name: '確認対象の通報・ブロック' })).toHaveCount(1);
  await expect(page.getByLabel(/2位、確認対象、50/)).toBeVisible();
  await expect(page.getByText('本人の記録', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '確認対象の通報・ブロック' })).toHaveCount(1);
  await page.getByRole('button', { name: 'マイページを開く' }).click();
  await page.getByRole('button', { name: '設定を開く' }).click();
  await expect(page.getByRole('button', { name: '確認対象のブロックを解除' })).toBeVisible();
  await assertAccessible(page);
  await page.screenshot({ path: testInfo.outputPath('blocked-settings.png'), fullPage: true });
  await page.getByRole('button', { name: '確認対象のブロックを解除' }).click();
  await expect(page.getByText('ブロックしているプレイヤーはいません。')).toBeVisible();
  await page.getByRole('button', { name: '前の画面に戻る' }).click();
  await page.getByRole('button', { name: 'ホームに戻る' }).click();
  await expect(page.getByRole('button', { name: '確認対象の通報・ブロック' })).toHaveCount(2);
  expect(state.authorization.every((value) => /^Bearer [0-9a-f-]{36}$/i.test(value))).toBe(true);
});

test('failed reports do not show a false receipt and remain retryable', async ({ page }) => {
  const state = await mockApi(page);
  state.failReports = true;
  await page.goto('/');
  await page.getByRole('button', { name: '確認対象の通報・ブロック' }).first().click();
  await page.getByRole('button', { name: '名前を通報', exact: true }).click();
  await page.getByRole('button', { name: '通報を送信' }).click();
  await expect(page.getByText('処理を完了できませんでした。通信状態を確認して、もう一度お試しください。')).toBeVisible();
  await expect(page.getByText('通報を受け付けました。運営が確認します。')).toHaveCount(0);
  state.failReports = false;
  await page.getByRole('button', { name: '通報を送信' }).click();
  await expect(page.getByText('通報を受け付けました。運営が確認します。')).toBeVisible();
  await page.getByRole('button', { name: 'ランキングの操作を閉じる' }).click();
  await expect(page.getByRole('button', { name: '確認対象の通報・ブロック' })).toHaveCount(2);
});

test('NG names and restricted users receive the real reason before starting without posting a score', async ({ page }) => {
  const state = await mockApi(page);
  for (const code of ['NAME_NOT_ALLOWED', 'PLAYER_RESTRICTED']) {
    state.sessionRejection = code;
    await page.goto('/');
    await page.getByLabel('プレイヤー名').fill('名前確認');
    await page.getByRole('button', { name: 'いちごモードでゲームを開始' }).click();
    await expect(page.getByText('名前または公開ランキングへの参加を確認してください。', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'いちごつめ！' })).toBeVisible();
    await expect(page.getByRole('button', { name: /選択肢[12]、/ })).toHaveCount(0);
  }
  expect(state.scoreRequests).toBe(0);
});
