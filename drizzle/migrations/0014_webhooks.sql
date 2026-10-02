-- Outbound webhook endpoints.
CREATE TABLE IF NOT EXISTS webhook_endpoints (
	id text PRIMARY KEY NOT NULL,
	agency_id text NOT NULL REFERENCES agencies(id),
	url text NOT NULL,
	secret text NOT NULL,
	active integer DEFAULT 1 NOT NULL,
	created_at integer
);
