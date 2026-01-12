-- CRITICAL SECURITY FIX: Update scan_logs_business view to include owner_id for multi-tenancy filtering
-- Run this in your Supabase SQL Editor IMMEDIATELY

-- Must DROP first because we're adding a new column
DROP VIEW IF EXISTS scan_logs_business;

-- Recreate the view with owner_id from card_templates
CREATE VIEW scan_logs_business AS
SELECT 
  t.id,
  t.created_at AS scanned_at,
  t.type AS action,  -- 'accrue' or 'redeem'
  t.amount,
  NULL AS location,  -- can be added later if needed
  c.uuid AS card_uuid,
  c.guest_name,
  ct.user_facing_name AS template_name,
  ct.user_id AS owner_id,  -- SECURITY: Added for multi-tenancy filtering
  t.cashier_id
FROM transactions t
LEFT JOIN issued_cards c ON t.user_id = c.uuid
LEFT JOIN card_templates ct ON c.card_template_id = ct.id
ORDER BY t.created_at DESC;

-- Grant access to authenticated users
GRANT SELECT ON scan_logs_business TO authenticated;

-- Verify the view has owner_id
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'scan_logs_business' 
ORDER BY ordinal_position;
