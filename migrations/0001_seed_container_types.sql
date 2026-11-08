-- Seed: ISO standard container types (typical values; vary by manufacturer).
-- practical_payload_kg is NULL on purpose: the commercial limit (road / carrier rules)
-- is a business decision and must be entered from the admin panel.
INSERT INTO `container_types`
  (`code`, `name_en`, `name_tr`, `inner_length_mm`, `inner_width_mm`, `inner_height_mm`,
   `door_width_mm`, `door_height_mm`, `tare_kg`, `max_payload_kg`, `practical_payload_kg`,
   `enabled`, `sort_order`)
VALUES
  ('20DV', '20'' Dry Van',      '20''lik Standart',   5898, 2352, 2393, 2340, 2280, 2230, 28200, NULL, 1, 10),
  ('40DV', '40'' Dry Van',      '40''lık Standart',  12032, 2352, 2393, 2340, 2280, 3750, 26700, NULL, 1, 20),
  ('40HC', '40'' High Cube',    '40''lık High Cube', 12032, 2352, 2698, 2340, 2585, 3900, 26500, NULL, 1, 30);
--> statement-breakpoint
INSERT INTO `settings` (`key`, `value`) VALUES
  ('currency', '"USD"'),
  ('quote_validity_days', '30'),
  ('quote_number_prefix', '"SM"');
