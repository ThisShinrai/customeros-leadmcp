-- Geld-Cluster: dunning (reminders), recurring invoices, time tracking.

ALTER TABLE invoices ADD COLUMN reminder_level integer NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN last_reminder_at integer;

CREATE TABLE IF NOT EXISTS recurring_invoices (
  id text PRIMARY KEY NOT NULL,
  agency_id text NOT NULL,
  client_id text NOT NULL,
  project_id text NOT NULL,
  title text NOT NULL,
  notes text,
  items text NOT NULL,
  interval_months integer NOT NULL DEFAULT 1,
  next_run_at integer NOT NULL,
  auto_release integer NOT NULL DEFAULT 1,
  active integer NOT NULL DEFAULT 1,
  last_generated_at integer,
  created_at integer,
  updated_at integer
);
CREATE INDEX IF NOT EXISTS idx_recurring_agency ON recurring_invoices(agency_id);

CREATE TABLE IF NOT EXISTS time_entries (
  id text PRIMARY KEY NOT NULL,
  agency_id text NOT NULL,
  project_id text NOT NULL,
  user_id text NOT NULL,
  user_name text,
  description text NOT NULL,
  minutes integer NOT NULL,
  occurred_at integer NOT NULL,
  billable integer NOT NULL DEFAULT 1,
  rate_cents integer,
  invoice_id text,
  created_at integer
);
CREATE INDEX IF NOT EXISTS idx_time_agency ON time_entries(agency_id);
CREATE INDEX IF NOT EXISTS idx_time_project ON time_entries(project_id);
