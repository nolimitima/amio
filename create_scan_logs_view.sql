-- Create scan_logs_business view for Dashboard
-- This view transforms the transactions table into a format expected by ScanLogsList component

CREATE OR REPLACE VIEW scan_logs_business AS
SELECT 
  t.id,
  t.created_at AS scanned_at,
  t.type AS action,  -- 'accrue' or 'redeem'
  t.amount,
  NULL AS location,  -- can be added later if needed
  c.uuid AS card_uuid,
  c.guest_name,
  ct.user_facing_name AS template_name,
  t.cashier_id
FROM transactions t
LEFT JOIN issued_cards c ON t.user_id = c.uuid
LEFT JOIN card_templates ct ON c.card_template_id = ct.id
ORDER BY t.created_at DESC;

-- Grant access to authenticated users
GRANT SELECT ON scan_logs_business TO authenticated;

-- Add RLS policy for the view (inherits from base tables)
-- Users can view transactions they created (as cashiers)
-- This is already covered by the transactions table RLS policy
