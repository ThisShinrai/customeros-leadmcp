-- Agency-wide tasks board: custom columns + task→column link.
CREATE TABLE IF NOT EXISTS task_columns (
	id text PRIMARY KEY NOT NULL,
	agency_id text NOT NULL REFERENCES agencies(id),
	name text NOT NULL,
	color text DEFAULT '#909090' NOT NULL,
	sort_order integer DEFAULT 0 NOT NULL,
	is_done integer DEFAULT 0 NOT NULL,
	created_at integer
);
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN task_column_id text;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN board_sort integer DEFAULT 0 NOT NULL;
