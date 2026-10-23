import assert from 'node:assert/strict';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const releasePlatforms = (platform) => {
  assert.ok(['ios', 'android', 'all'].includes(platform), 'Choose ios, android, or all.');
  return platform === 'all' ? ['ios', 'android'] : [platform];
};

export const validateMobileRelease = ({ expo, eas, platform, submit, env }) => {
  const platforms = releasePlatforms(platform);
  assert.ok(uuid.test(expo.extra?.eas?.projectId ?? ''), 'Set the real EAS_PROJECT_ID from the Expo project.');
  assert.ok(env.EXPO_TOKEN, 'Configure EXPO_TOKEN in the mobile-production environment.');
  assert.equal(env.GITHUB_REF, 'refs/heads/main', 'Production store builds must run from reviewed main.');
  assert.equal(eas.build.production.distribution, 'store');
  if (submit && platforms.includes('ios')) {
    assert.match(
      eas.submit.production.ios?.ascAppId ?? '',
      /^[1-9]\d+$/,
      'Set the real App Store Connect ascAppId in eas.json before submitting.',
    );
  }
  return platforms;
};

export const completedBuilds = (builds, platform) => {
  const platforms = releasePlatforms(platform);
  assert.ok(Array.isArray(builds), 'EAS must return a JSON array of builds.');
  assert.equal(builds.length, platforms.length, 'Every requested platform must have exactly one build.');
  return platforms.map((target) => {
    const matches = builds.filter((build) => build.platform?.toLowerCase() === target);
    assert.equal(matches.length, 1, `Expected one ${target} build from this invocation.`);
    const build = matches[0];
    assert.ok(uuid.test(build.id), 'A real EAS build ID is required.');
    assert.equal(build.status, 'FINISHED', 'Only a successfully finished build may be submitted.');
    return { platform: target, id: build.id };
  });
};
