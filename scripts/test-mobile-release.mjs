import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { completedBuilds, validateMobileRelease } from './mobile-release-contract.mjs';

const id = '12345678-1234-1234-1234-123456789abc';
const prerequisites = () => ({
  expo: { extra: { eas: { projectId: id } } },
  eas: {
    build: { production: { distribution: 'store' } },
    submit: { production: { ios: { ascAppId: '1234567890' } } },
  },
  env: { EXPO_TOKEN: 'test-token', GITHUB_REF: 'refs/heads/main' },
  platform: 'ios',
  submit: true,
});

test('a store release requires the real project, a token, and reviewed main', () => {
  assert.deepEqual(validateMobileRelease(prerequisites()), ['ios']);
  for (const field of ['EXPO_TOKEN', 'GITHUB_REF']) {
    const input = prerequisites();
    delete input.env[field];
    assert.throws(() => validateMobileRelease(input));
  }
  const input = prerequisites();
  input.expo.extra.eas.projectId = 'your-project-id';
  assert.throws(() => validateMobileRelease(input));
});

test('an iOS submission cannot proceed without an App Store Connect app ID', () => {
  const input = prerequisites();
  delete input.eas.submit.production.ios.ascAppId;
  assert.throws(() => validateMobileRelease(input), /ascAppId/);
  input.submit = false;
  assert.deepEqual(validateMobileRelease(input), ['ios']);
});

test('only the finished artifact of each requested platform is selected for submission', () => {
  const ios = { id, platform: 'IOS', status: 'FINISHED' };
  const android = { ...ios, id: 'abcdef12-1234-1234-1234-123456789abc', platform: 'ANDROID' };
  assert.deepEqual(completedBuilds([ios], 'ios'), [{ id, platform: 'ios' }]);
  assert.equal(completedBuilds([ios, android], 'all').length, 2);
  for (const builds of [[], [ios, ios], [{ ...ios, status: 'ERRORED' }], [{ ...ios, id: '--latest' }], [android]]) {
    assert.throws(() => completedBuilds(builds, 'ios'));
  }
  assert.throws(() => completedBuilds({}, 'ios'));
  assert.throws(() => completedBuilds([ios], 'all'));
  assert.throws(() => completedBuilds([ios], 'invalid'));
});

test('native screenshot names remain inside the Maestro artifact directory', async () => {
  const { loadAll } = createRequire(import.meta.url)('js-yaml');
  const [, commands] = loadAll(await readFile(new URL('../.maestro/ios-smoke.yaml', import.meta.url), 'utf8'));
  const screenshotNames = [];
  const collect = (steps) => {
    for (const step of steps) {
      if (step.takeScreenshot) {screenshotNames.push(step.takeScreenshot);}
      if (step.tapOn) {assert.equal(step.tapOn.waitToSettleTimeoutMs, 500);}
      if (step.scrollUntilVisible) {assert.equal(step.scrollUntilVisible.waitToSettleTimeoutMs, 500);}
      if (step.runFlow?.commands) {collect(step.runFlow.commands);}
    }
  };
  collect(commands);
  assert.equal(screenshotNames.length, 9);
  assert.ok(screenshotNames.includes('home-landscape'));
  assert.ok(screenshotNames.includes('privacy'));
  assert.ok(!screenshotNames.includes('game-landscape'));
  for (const name of screenshotNames) {
    assert.match(name, /^[a-z][a-z0-9-]*$/);
  }
});

test('native timed rounds finish naturally and both strawberry memory prompts are handled', async () => {
  const { loadAll } = createRequire(import.meta.url)('js-yaml');
  const [, commands] = loadAll(await readFile(new URL('../.maestro/ios-smoke.yaml', import.meta.url), 'utf8'));
  assert.equal(commands.filter((step) => step.extendedWaitUntil?.visible === 'ゲーム終了').length, 4);
  for (const title of ['記憶チャレンジ', '最終記憶チャレンジ']) {
    const flow = commands.find((step) => step.runFlow?.when?.visible === title)?.runFlow;
    assert.ok(flow?.commands.some((step) => step.tapOn?.text === '選択肢1、.*'));
  }
  const timedSteps = commands.slice(
    commands.findIndex((step) => step.pressKey === 'Enter'),
    commands.findLastIndex((step) => step.extendedWaitUntil?.visible === 'ゲーム終了'),
  );
  assert.ok(!timedSteps.some((step) => step.evalScript || step.copyTextFrom));
});

test('native saved names are verified from the intended input values rather than unrelated text', async () => {
  const { loadAll } = createRequire(import.meta.url)('js-yaml');
  const [, commands] = loadAll(await readFile(new URL('../.maestro/ios-smoke.yaml', import.meta.url), 'utf8'));
  assert.deepEqual(
    commands.filter((step) => step.copyTextFrom).map((step) => step.copyTextFrom.id),
    ['player-name', 'player-name', 'profile-player-name'],
  );
  assert.equal(commands.filter((step) => step.assertTrue === "${maestro.copiedText === 'NativeQA'}").length, 3);
  assert.ok(!commands.some((step) => step.assertVisible === 'NativeQA'));
});

test('native CI preserves each test attempt and allows slow simulator driver startup', async () => {
  const { load } = createRequire(import.meta.url)('js-yaml');
  const workflow = load(await readFile(new URL('../.github/workflows/ios-native-validation.yml', import.meta.url), 'utf8'));
  assert.equal(workflow.env.MAESTRO_DRIVER_STARTUP_TIMEOUT, '240000');
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps.filter((entry) => entry.uses?.startsWith('actions/upload-artifact@'))) {
      if (step.with.name === 'ios-simulator-app') {
        assert.equal(step.with.overwrite, true);
      } else {
        assert.ok(step.with.name.includes('github.run_attempt'));
      }
    }
  }
});
