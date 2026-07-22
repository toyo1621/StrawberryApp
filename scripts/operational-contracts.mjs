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
