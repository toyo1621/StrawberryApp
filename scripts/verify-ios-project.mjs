import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const plist = require('@expo/plist').default;
const xcode = require('xcode');
const {
  default: { expo },
} = await import('../app.config.js');
const iosDirectory = new URL('../ios/', import.meta.url);
const entries = await readdir(iosDirectory);
const projects = entries.filter((entry) => entry.endsWith('.xcodeproj'));
assert.equal(projects.length, 1, 'Run npm run prebuild:ios to generate one iOS project.');
const projectName = projects[0].slice(0, -'.xcodeproj'.length);
const info = plist.parse(await readFile(new URL(`${projectName}/Info.plist`, iosDirectory), 'utf8'));
assert.equal(info.CFBundleDisplayName, expo.name);
assert.equal(info.CFBundleShortVersionString, expo.version);
assert.equal(info.UIRequiresFullScreen, false, 'iPad windows must be resizable.');
assert.deepEqual(
  new Set(info['UISupportedInterfaceOrientations~ipad']),
  new Set([
    'UIInterfaceOrientationPortrait',
    'UIInterfaceOrientationPortraitUpsideDown',
    'UIInterfaceOrientationLandscapeLeft',
    'UIInterfaceOrientationLandscapeRight',
  ]),
);
assert.deepEqual(info.UISupportedInterfaceOrientations, [
  'UIInterfaceOrientationPortrait',
  'UIInterfaceOrientationPortraitUpsideDown',
]);
assert.equal(info.ITSAppUsesNonExemptEncryption, false);
assert.equal(info.NSAppTransportSecurity?.NSAllowsArbitraryLoads, false);
assert.equal(info.NSFaceIDUsageDescription, undefined, 'Identity storage does not use biometric authentication.');
assert.deepEqual(info.CFBundleLocalizations, ['ja']);

const project = xcode.project(new URL(`${projects[0]}/project.pbxproj`, iosDirectory).pathname);
project.parseSync();
const settings = Object.values(project.pbxXCBuildConfigurationSection())
  .filter((entry) => typeof entry === 'object' && entry.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER)
  .map((entry) => entry.buildSettings);
const unquote = (value) => (value.startsWith('"') ? JSON.parse(value) : value);
assert.equal(settings.length, 2, 'Both Debug and Release must target this app.');
for (const setting of settings) {
  assert.equal(unquote(setting.PRODUCT_BUNDLE_IDENTIFIER), expo.ios.bundleIdentifier);
  assert.equal(unquote(setting.TARGETED_DEVICE_FAMILY), '1,2');
  assert.equal(setting.IPHONEOS_DEPLOYMENT_TARGET, '15.1');
}
console.log(
  `Generated iOS project verified: ${join('ios', projectName)}, iPhone + iPad, iOS 15.1+, all iPad orientations.`,
);
