CREATE TABLE `inbound_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inbound_owner_source_external` ON `inbound_leads` (`owner`,`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `inbound_owner_status` ON `inbound_leads` (`owner`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `workspace_settings` (
	`owner` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `key`)
);
