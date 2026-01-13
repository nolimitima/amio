-- Add cashback_percent to card_templates
-- This allows each template to have a custom cashback percentage
-- NULL = use global app_settings.cashback_percent

ALTER TABLE card_templates 
ADD COLUMN IF NOT EXISTS cashback_percent INTEGER DEFAULT NULL;

-- Optional: Set cashback for existing templates
-- UPDATE card_templates SET cashback_percent = 10 WHERE internal_name = 'premium_card';
-- UPDATE card_templates SET cashback_percent = 3 WHERE internal_name = 'basic_card';

-- Verify column added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'card_templates' AND column_name = 'cashback_percent';
