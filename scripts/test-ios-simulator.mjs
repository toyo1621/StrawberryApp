import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

assert.equal(process.platform, 'darwin', 'Full Xcode and macOS are required for native iOS UI tests.');
assert.equal(process.env.EXPO_PUBLIC_RANKINGS_API_URL, '', 'Native UI tests must not send scores to production.');
const family = process.argv[2];
assert.ok(['iPhone', 'iPad'].includes(family), 'Choose iPhone or iPad.');
const largeText = process.argv.includes('--large-text');
const artifactDirectory = resolve('.tmp/ios-native', `${family}${largeText ? '-large-text' : ''}`);
await mkdir(artifactDirectory, { recursive: true });
const simctl = (...args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' }).trim();
const runtimes = JSON.parse(simctl('list', 'runtimes', '--json')).runtimes;
const runtime = runtimes
  .filter((entry) => entry.isAvailable && entry.identifier.includes('.iOS-26-'))
  .sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true }))[0];
assert.ok(runtime, 'Install an iOS 26 simulator runtime.');
const deviceTypes = JSON.parse(simctl('list', 'devicetypes', '--json')).devicetypes;
const deviceType = deviceTypes
  .filter((entry) => entry.name.startsWith(family))
  .sort((left, right) => {
    const preferred = (name) => Number(name.includes(family === 'iPad' ? '13-inch' : 'Pro Max'));
    return preferred(right.name) - preferred(left.name);
  })[0];
assert.ok(deviceType, `An ${family} simulator device type is required.`);
const udid = simctl('create', `TsumeChallenge-QA-${family}-${Date.now()}`, deviceType.identifier, runtime.identifier);

try {
  simctl('boot', udid);
  simctl('bootstatus', udid, '-b');
  simctl(
    'status_bar',
    udid,
    'override',
    '--time',
    '9:41',
    '--dataNetwork',
    'wifi',
    '--wifiMode',
    'active',
    '--wifiBars',
    '3',
    '--batteryState',
    'charged',
    '--batteryLevel',
    '100',
  );
  if (largeText) {
    simctl('ui', udid, 'content_size', 'accessibility-extra-extra-extra-large');
  }
  const appPath = resolve('.tmp/ios-derived-data/Build/Products/Release-iphonesimulator/app.app');
  const info = JSON.parse(
    execFileSync('plutil', ['-convert', 'json', '-o', '-', resolve(appPath, 'Info.plist')], { encoding: 'utf8' }),
  );
  assert.deepEqual(info.UIDeviceFamily, [1, 2]);
  assert.ok(Number(info.DTSDKName?.match(/\d+/)?.[0]) >= 26, 'The native app must use iOS SDK 26 or later.');
  assert.equal(info.ITSAppUsesNonExemptEncryption, false);
  const privacy = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', resolve(appPath, 'PrivacyInfo.xcprivacy')], { encoding: 'utf8' }));
  assert.equal(privacy.NSPrivacyTracking, false);
  assert.equal(privacy.NSPrivacyCollectedDataTypes.length, 3, 'The compiled app must declare the ranking data collection.');
  simctl('install', udid, appPath);
  await writeFile(
    resolve(artifactDirectory, 'device.json'),
    JSON.stringify(
      {
        family,
        largeText,
        runtime: runtime.version,
        device: deviceType.name,
        appVersion: info.CFBundleShortVersionString,
        buildNumber: info.CFBundleVersion,
        sdk: info.DTSDKName,
        commit: process.env.GITHUB_SHA ?? null,
      },
      null,
      2,
    ),
  );
  execFileSync(
    'maestro',
    [
      '--device',
      udid,
      'test',
      '.maestro/ios-smoke.yaml',
      '--format',
      'junit',
      '--output',
      resolve(artifactDirectory, 'results.xml'),
      '--debug-output',
      artifactDirectory,
      '-e',
      `DEVICE_FAMILY=${family}`,
      '-e',
      `ARTIFACT_DIR=${artifactDirectory}`,
    ],
    { stdio: 'inherit', timeout: 600_000 },
  );
} finally {
  try {
    simctl('io', udid, 'screenshot', resolve(artifactDirectory, 'final-screen.png'));
  } catch (error) {
    console.warn('Could not capture the final simulator screen:', error.message);
  }
  try {
    simctl('shutdown', udid);
  } finally {
    simctl('delete', udid);
  }
}
