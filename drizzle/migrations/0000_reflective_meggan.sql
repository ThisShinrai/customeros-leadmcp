CREATE TABLE `agencies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`accent_color` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agencies_slug_unique` ON `agencies` (`slug`);--> statement-breakpoint
CREATE TABLE `agency_users` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`avatar_frame_color` text,
	`bio` text,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`invite_token` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `client_users` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`company` text,
	`avatar_url` text,
	`avatar_frame_color` text,
	`portal_enabled` integer DEFAULT false NOT NULL,
	`last_login_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_clients` (
	`project_id` text NOT NULL,
	`client_id` text NOT NULL,
	`added_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `client_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_members` (
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`added_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `agency_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'open' NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`due_date` integer,
	`assignee_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `agency_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'project' NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_participants` (
	`channel_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`participant_type` text NOT NULL,
	`joined_at` integer,
	FOREIGN KEY (`channel_id`) REFERENCES `chat_channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`sender_type` text NOT NULL,
	`content` text NOT NULL,
	`read_at` integer,
	`created_at` integer,
	FOREIGN KEY (`channel_id`) REFERENCES `chat_channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`agency_id` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`uploader_type` text NOT NULL,
	`visible_to_client` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`tax_rate` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`agency_id` text NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`due_date` integer,
	`total_amount` integer NOT NULL,
	`pdf_r2_key` text,
	`visible_to_client` integer DEFAULT false NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `client_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` text NOT NULL,
	`permission` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`user_id` text NOT NULL,
	`permission` text NOT NULL,
	`granted` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `agency_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`assigned_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `agency_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
