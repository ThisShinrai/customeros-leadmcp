-- Custom agency-level Kanban boards (independent of projects).
-- Idempotent (IF NOT EXISTS): already applied to local + remote D1 via raw execute.
CREATE TABLE IF NOT EXISTS boards (
	id text PRIMARY KEY NOT NULL,
	agency_id text NOT NULL REFERENCES agencies(id),
	name text NOT NULL,
	border_color text DEFAULT '#3B82F6' NOT NULL,
	sort_order integer DEFAULT 0 NOT NULL,
	created_at integer,
	updated_at integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS board_lists (
	id text PRIMARY KEY NOT NULL,
	board_id text NOT NULL REFERENCES boards(id),
	name text NOT NULL,
	color text DEFAULT '#909090' NOT NULL,
	sort_order integer DEFAULT 0 NOT NULL,
	created_at integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS board_cards (
	id text PRIMARY KEY NOT NULL,
	board_id text NOT NULL REFERENCES boards(id),
	list_id text NOT NULL REFERENCES board_lists(id),
	title text NOT NULL,
	description text,
	sort_order integer DEFAULT 0 NOT NULL,
	created_at integer,
	updated_at integer
);
