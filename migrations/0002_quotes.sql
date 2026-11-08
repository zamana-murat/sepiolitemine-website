CREATE TABLE `quotes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`seq` integer NOT NULL,
	`number` text NOT NULL,
	`public_id` text NOT NULL,
	`locale` text NOT NULL,
	`currency` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_company` text NOT NULL,
	`customer_email` text NOT NULL,
	`customer_country` text NOT NULL,
	`customer_phone` text DEFAULT '' NOT NULL,
	`customer_note` text DEFAULT '' NOT NULL,
	`request` text NOT NULL,
	`result` text NOT NULL,
	`terms` text NOT NULL,
	`total_cents` integer NOT NULL,
	`valid_until` integer NOT NULL,
	`pdf_key` text,
	`email_status` text,
	`status` text DEFAULT 'new' NOT NULL,
	`admin_note` text DEFAULT '' NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_number_unique` ON `quotes` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_public_id_unique` ON `quotes` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_quotes_year_seq` ON `quotes` (`year`,`seq`);--> statement-breakpoint
CREATE INDEX `idx_quotes_created` ON `quotes` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_quotes_email` ON `quotes` (`customer_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_quotes_ip` ON `quotes` (`ip_hash`,`created_at`);