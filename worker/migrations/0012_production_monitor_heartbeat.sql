CREATE TABLE IF NOT EXISTS service_heartbeats (
  monitor_name TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'healthy', 'unhealthy')),
  checked_at TEXT NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  details TEXT NOT NULL DEFAULT ''
);

INSERT INTO service_heartbeats (monitor_name, status, checked_at, latency_ms, details)
VALUES ('production', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 0, 'Waiting for the first scheduled check.')
ON CONFLICT(monitor_name) DO NOTHING;
