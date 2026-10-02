CREATE TABLE `whiteboards` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text DEFAULT 'Whiteboard' NOT NULL,
	`scene` text,
	`shared_with_client` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_by` text,
	`updated_by_name` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `agencies` ADD `login_bg_color` text;--> statement-breakpoint
ALTER TABLE `agencies` ADD `portal_accent_text` text;