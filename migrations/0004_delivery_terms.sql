CREATE TABLE `delivery_terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`incoterm` text NOT NULL,
	`place_en` text NOT NULL,
	`place_tr` text NOT NULL,
	`payment_terms_en` text DEFAULT '' NOT NULL,
	`payment_terms_tr` text DEFAULT '' NOT NULL,
	`notes_en` text DEFAULT '' NOT NULL,
	`notes_tr` text DEFAULT '' NOT NULL,
	`price_type` text DEFAULT 'fixed' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
-- Carry the single delivery term from the old settings over as the first term (if one was set).
INSERT INTO `delivery_terms` (`incoterm`, `place_en`, `place_tr`, `payment_terms_en`, `payment_terms_tr`)
SELECT
	json_extract(i.value, '$'),
	COALESCE((SELECT json_extract(value, '$') FROM settings WHERE key = 'incoterm_place'), ''),
	COALESCE((SELECT json_extract(value, '$') FROM settings WHERE key = 'incoterm_place'), ''),
	COALESCE((SELECT json_extract(value, '$') FROM settings WHERE key = 'payment_terms_en'), ''),
	COALESCE((SELECT json_extract(value, '$') FROM settings WHERE key = 'payment_terms_tr'), '')
FROM settings i
WHERE i.key = 'incoterm';
