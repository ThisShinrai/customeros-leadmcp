ALTER TABLE `projects` ADD `chat_bypass` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_participants` ADD `last_typing_at` integer;