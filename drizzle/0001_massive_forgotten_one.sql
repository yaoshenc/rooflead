CREATE TABLE `roof_outlines` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`research_id` text NOT NULL,
	`status` text NOT NULL,
	`response_id` text,
	`payload` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outline_owner_created` ON `roof_outlines` (`owner`,`created_at`);