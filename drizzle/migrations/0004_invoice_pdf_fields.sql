ALTER TABLE `invoices` ADD `invoice_number` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `pdf_generated` integer DEFAULT false NOT NULL;