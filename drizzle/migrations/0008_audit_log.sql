-- Append-only audit trail for security-/billing-relevant agency mutations.
CREATE TABLE IF NOT EXISTS audit_logs (
	id text PRIMARY KEY NOT NULL,
	agency_id text NOT NULL REFERENCES agencies(id),
	actor_id text,
	actor_name text,
	action text NOT NULL,
	target_type text,
	target_id text,
	meta text,
	created_at integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_logs_agency_created_idx ON audit_logs (agency_id, created_at);
