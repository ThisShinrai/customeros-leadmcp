-- Engagement batch 1: file folders + per-user email preference.

CREATE TABLE IF NOT EXISTS folders (
  id text PRIMARY KEY NOT NULL,
  agency_id text NOT NULL,
  project_id text NOT NULL,
  name text NOT NULL,
  parent_id text,
  visible_to_client integer NOT NULL DEFAULT 0,
  created_by text,
  created_at integer
);
CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id);

ALTER TABLE files ADD COLUMN folder_id text;

ALTER TABLE agency_users ADD COLUMN email_frequency text NOT NULL DEFAULT 'sofort';
ALTER TABLE client_users ADD COLUMN email_frequency text NOT NULL DEFAULT 'sofort';
