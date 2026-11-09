CREATE TABLE `research_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`lead_id` text NOT NULL,
	`status` text NOT NULL,
	`response_id` text,
	`payload` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_owner_created` ON `research_jobs` (`owner`,`created_at`);