-- Project resources / embeds (Figma, Loom, Google Docs, Calendly …).
CREATE TABLE IF NOT EXISTS project_resources (
	id text PRIMARY KEY NOT NULL,
	agency_id text NOT NULL REFERENCES agencies(id),
	project_id text NOT NULL REFERENCES projects(id),
	title text NOT NULL,
	url text NOT NULL,
	sort_order integer DEFAULT 0 NOT NULL,
	created_at integer
);
