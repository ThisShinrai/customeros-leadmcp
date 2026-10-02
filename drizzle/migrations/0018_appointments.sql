-- Terminbuchung: agency-published bookable slots, booked by portal clients.
CREATE TABLE IF NOT EXISTS appointments (
  id text PRIMARY KEY NOT NULL,
  agency_id text NOT NULL,
  title text NOT NULL,
  description text,
  location text,
  status text NOT NULL DEFAULT 'available',
  start_at integer NOT NULL,
  end_at integer NOT NULL,
  project_id text,
  booked_client_id text,
  booked_at integer,
  booked_note text,
  created_at integer,
  updated_at integer
);
CREATE INDEX IF NOT EXISTS idx_appointments_agency ON appointments(agency_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
