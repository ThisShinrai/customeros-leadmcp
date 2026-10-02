-- E-Rechnung (EN 16931): structured legal address + SEPA payment on agencies + buyer address/VAT on clients.
ALTER TABLE agencies ADD COLUMN iban text;
--> statement-breakpoint
ALTER TABLE agencies ADD COLUMN bic text;
--> statement-breakpoint
ALTER TABLE agencies ADD COLUMN street text;
--> statement-breakpoint
ALTER TABLE agencies ADD COLUMN zip text;
--> statement-breakpoint
ALTER TABLE agencies ADD COLUMN city text;
--> statement-breakpoint
ALTER TABLE agencies ADD COLUMN country text;
--> statement-breakpoint
ALTER TABLE client_users ADD COLUMN street text;
--> statement-breakpoint
ALTER TABLE client_users ADD COLUMN zip text;
--> statement-breakpoint
ALTER TABLE client_users ADD COLUMN city text;
--> statement-breakpoint
ALTER TABLE client_users ADD COLUMN country text;
--> statement-breakpoint
ALTER TABLE client_users ADD COLUMN vat_id text;
