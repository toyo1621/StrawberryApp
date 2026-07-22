import { RANKINGS_API_VERSION } from './generated/rankingContract.mjs';

export const matchesRankingsRelease = ({
  ok,
  headerVersion,
  headerReleaseId,
  body,
  expectedVersion,
  expectedReleaseId,
}) => (
  ok
  && headerVersion === expectedVersion
  && String(body?.version) === expectedVersion
  && body?.ok === true
  && (!expectedReleaseId || (
    body?.release === expectedReleaseId
    && headerReleaseId === expectedReleaseId
  ))
);

export const isSyntheticCleanupComplete = ({
  syntheticScoreCreated,
  deleted,
  history,
  submissionId,
}) => (
  Number.isInteger(deleted)
  && (!syntheticScoreCreated || deleted >= 1)
  && Array.isArray(history)
  && !history.some((entry) => entry?.id === submissionId)
);

export const isReleaseMetadata = (value, expectedReleaseId) => (
  Boolean(value)
  && typeof value.release === 'string'
  && (/^[0-9a-f]{40}$/.test(value.release) || value.release === 'development')
  && value.apiVersion === RANKINGS_API_VERSION
  && (!expectedReleaseId || value.release === expectedReleaseId)
);

export const isCompatibleProductionRelease = ({ webRelease, apiHealth, apiHeaderRelease }) => (
  isReleaseMetadata(webRelease)
  && webRelease.release !== 'development'
  && apiHealth?.ok === true
  && apiHealth?.version === webRelease.apiVersion
  && apiHealth?.release === webRelease.release
  && apiHeaderRelease === webRelease.release
);

export const extractJavaScriptPaths = (html) => {
  if (typeof html !== 'string') {
    return [];
  }

  return [...new Set(
    [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js(?:\?[^"]*)?)"[^>]*>/gi)]
      .map((match) => match[1]),
  )];
};

export const hasHealthyJavaScriptBundles = (bundles, minimumTotalBytes = 100_000) => (
  Array.isArray(bundles)
  && bundles.length > 0
  && bundles.every((bundle) => (
    bundle?.ok === true
    && typeof bundle.contentType === 'string'
    && bundle.contentType.includes('javascript')
    && Number.isInteger(bundle.byteLength)
    && bundle.byteLength > 0
  ))
  && bundles.reduce((total, bundle) => total + bundle.byteLength, 0) >= minimumTotalBytes
);
