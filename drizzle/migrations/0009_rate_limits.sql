-- D1-backed fixed-window rate limiter store (used by src/lib/rate-limit.ts).
CREATE TABLE IF NOT EXISTS rate_limits (
	key text PRIMARY KEY NOT NULL,
	count integer NOT NULL DEFAULT 0,
	window_start integer NOT NULL DEFAULT 0
);
