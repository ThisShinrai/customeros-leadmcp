-- Public REST API keys (SHA-256 hashed).
CREATE TABLE IF NOT EXISTS api_keys (
	id text PRIMARY KEY NOT NULL,
	agency_id text NOT NULL REFERENCES agencies(id),
	name text NOT NULL,
	key_hash text NOT NULL,
	prefix text NOT NULL,
	last_used_at integer,
	revoked_at integer,
	created_at integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys (key_hash);
