-- Leads (Vertriebs-Pipeline, aus dem internen Sales Manager übernommen).
-- Hinweis: drizzle-kit hatte hier den kompletten Journal-Rückstand generiert
-- (0007–0021 wurden seinerzeit handgeschrieben und waren längst angewendet);
-- diese Datei wurde auf den tatsächlich neuen Teil (leads + lead_notes) reduziert.
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`company` text NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`website_url` text DEFAULT '' NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`analysis` text DEFAULT '' NOT NULL,
	`recommendation` text DEFAULT '' NOT NULL,
	`estimated_cents` integer,
	`status` text DEFAULT 'neu' NOT NULL,
	`next_action_on` integer,
	`do_not_call` integer DEFAULT false NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`assigned_to` text,
	`converted_client_id` text,
	`site_check` text,
	`site_checked_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lead_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`author_name` text DEFAULT '' NOT NULL,
	`note` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
