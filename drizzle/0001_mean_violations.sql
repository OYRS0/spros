CREATE TABLE `admin_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`target` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `business_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`inn` text NOT NULL,
	`contact` text NOT NULL,
	`about` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pilot_events` (
	`session` text NOT NULL,
	`event` text NOT NULL,
	`entity` text DEFAULT '' NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`session`, `event`, `entity`)
);
--> statement-breakpoint
CREATE INDEX `idx_pilot_events_time` ON `pilot_events` (`created_at`);