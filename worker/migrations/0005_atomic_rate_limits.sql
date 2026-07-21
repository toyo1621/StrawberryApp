DROP TABLE IF EXISTS score_submission_events;

CREATE TABLE score_submission_buckets (
  identity_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  submission_count INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (identity_hash, window_start),
  CHECK (length(identity_hash) = 64),
  CHECK (submission_count BETWEEN 1 AND 8)
);

CREATE INDEX idx_score_submission_buckets_expires
  ON score_submission_buckets (expires_at);
