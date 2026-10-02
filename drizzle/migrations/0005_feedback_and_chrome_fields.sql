CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` integer,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `agencies` ADD `team_ads_disabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `agency_users` ADD `notifications_seen_at` integer;