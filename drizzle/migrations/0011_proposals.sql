-- Angebote (proposals/quotes) + simple e-signature.
CREATE TABLE IF NOT EXISTS proposals (
	id text PRIMARY KEY NOT NULL,
	agency_id text NOT NULL REFERENCES agencies(id),
	project_id text,
	client_id text NOT NULL REFERENCES client_users(id),
	number text,
	title text NOT NULL,
	intro text,
	status text DEFAULT 'draft' NOT NULL,
	total_amount integer DEFAULT 0 NOT NULL,
	valid_until integer,
	sent_at integer,
	viewed_at integer,
	signed_at integer,
	declined_at integer,
	signer_name text,
	signer_ip text,
	converted_invoice_id text,
	created_at integer,
	updated_at integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS proposal_items (
	id text PRIMARY KEY NOT NULL,
	proposal_id text NOT NULL REFERENCES proposals(id),
	description text NOT NULL,
	quantity integer NOT NULL,
	unit_price_cents integer NOT NULL,
	tax_rate integer DEFAULT 0 NOT NULL,
	sort_order integer DEFAULT 0 NOT NULL
);
