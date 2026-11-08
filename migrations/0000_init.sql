CREATE TABLE `container_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_en` text NOT NULL,
	`name_tr` text NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`description_tr` text DEFAULT '' NOT NULL,
	`group_name` text,
	`price_type` text NOT NULL,
	`amount` integer NOT NULL,
	`is_mandatory` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`container_type_id` integer,
	FOREIGN KEY (`container_type_id`) REFERENCES `container_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_container_options_type` ON `container_options` (`container_type_id`);--> statement-breakpoint
CREATE TABLE `container_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name_en` text NOT NULL,
	`name_tr` text NOT NULL,
	`inner_length_mm` integer NOT NULL,
	`inner_width_mm` integer NOT NULL,
	`inner_height_mm` integer NOT NULL,
	`door_width_mm` integer NOT NULL,
	`door_height_mm` integer NOT NULL,
	`tare_kg` integer NOT NULL,
	`max_payload_kg` integer NOT NULL,
	`practical_payload_kg` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `container_types_code_unique` ON `container_types` (`code`);--> statement-breakpoint
CREATE TABLE `order_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_en` text NOT NULL,
	`name_tr` text NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`description_tr` text DEFAULT '' NOT NULL,
	`group_name` text,
	`price_type` text NOT NULL,
	`amount` integer NOT NULL,
	`is_mandatory` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`doc_type` text NOT NULL,
	`title_en` text NOT NULL,
	`title_tr` text NOT NULL,
	`r2_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_documents_r2_key_unique` ON `product_documents` (`r2_key`);--> statement-breakpoint
CREATE INDEX `idx_documents_product` ON `product_documents` (`product_id`);--> statement-breakpoint
CREATE TABLE `product_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_en` text NOT NULL,
	`name_tr` text NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`description_tr` text DEFAULT '' NOT NULL,
	`group_name` text,
	`price_type` text NOT NULL,
	`amount` integer NOT NULL,
	`is_mandatory` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`product_id` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_product_options_product` ON `product_options` (`product_id`);--> statement-breakpoint
CREATE TABLE `product_packagings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`type` text NOT NULL,
	`name_en` text NOT NULL,
	`name_tr` text NOT NULL,
	`net_weight_kg` real NOT NULL,
	`gross_weight_kg` real NOT NULL,
	`length_mm` integer NOT NULL,
	`width_mm` integer NOT NULL,
	`height_mm` integer NOT NULL,
	`max_tiers` integer DEFAULT 1 NOT NULL,
	`allow_rotation` integer DEFAULT true NOT NULL,
	`price_basis` text DEFAULT 'per_ton' NOT NULL,
	`price_cents` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_packagings_product` ON `product_packagings` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name_en` text NOT NULL,
	`name_tr` text NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`description_tr` text DEFAULT '' NOT NULL,
	`hs_code` text,
	`specs` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
