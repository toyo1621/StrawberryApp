CREATE TABLE ranking_reports (
  id TEXT PRIMARY KEY,
  reporter_hash TEXT NOT NULL CHECK (length(reporter_hash) = 64),
  ranking_id TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('offensive', 'personal_information', 'impersonation', 'other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'hidden', 'dismissed', 'restored')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  UNIQUE (reporter_hash, ranking_id)
);
CREATE INDEX idx_ranking_reports_queue ON ranking_reports (status, created_at);
CREATE INDEX idx_ranking_reports_retention ON ranking_reports (created_at);
CREATE INDEX idx_ranking_reports_reporter_created ON ranking_reports (reporter_hash, created_at);

CREATE TABLE player_blocks (
  id TEXT PRIMARY KEY,
  blocker_hash TEXT NOT NULL CHECK (length(blocker_hash) = 64),
  subject_key TEXT NOT NULL,
  ranking_id TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (blocker_hash, subject_key)
);

CREATE TABLE moderated_subjects (
  subject_key TEXT PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE moderation_events (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('hide', 'dismiss', 'restore')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_moderation_events_created ON moderation_events (created_at);

CREATE TABLE moderation_name_rules (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL CHECK (length(term) BETWEEN 1 AND 12),
  match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'contains')),
  created_at TEXT NOT NULL,
  UNIQUE (term, match_type)
);
