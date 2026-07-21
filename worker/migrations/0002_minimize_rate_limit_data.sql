DROP TABLE IF EXISTS score_submission_events;

CREATE TABLE score_submission_events (
  id TEXT PRIMARY KEY,
  identity_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(identity_hash) = 64)
);

CREATE INDEX idx_score_submission_events_identity_created
  ON score_submission_events (identity_hash, created_at DESC);
