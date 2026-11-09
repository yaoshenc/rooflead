CREATE TABLE `job_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`job_key` text NOT NULL,
	`source` text NOT NULL,
	`content_type` text NOT NULL,
	`bytes` blob NOT NULL,
	`thumb` blob NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`size` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photos_owner_job` ON `job_photos` (`owner`,`job_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `upload_links` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`job_key` text NOT NULL,
	`label` text NOT NULL,
	`max_photos` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `upload_links_owner_job` ON `upload_links` (`owner`,`job_key`);