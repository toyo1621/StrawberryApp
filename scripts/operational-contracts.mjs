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
