-- POS Terminal Migration
-- Run this in Supabase SQL Editor

-- =============================================================================
-- 1. Create app_settings table
-- =============================================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  cashback_percent INTEGER DEFAULT 5 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO app_settings (cashback_percent)
SELECT 5
WHERE NOT EXISTS (SELECT 1 FROM app_settings LIMIT 1);

-- Enable RLS for app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policies for app_settings
DROP POLICY IF EXISTS "Authenticated users can read settings" ON app_settings;
DROP POLICY IF EXISTS "Service role can modify settings" ON app_settings;

-- Anyone authenticated can read settings
CREATE POLICY "Authenticated users can read settings" ON app_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- 2. Create transactions table
-- =============================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,  -- references issued_cards.uuid
  cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,  -- bill amount in currency
  points_change INTEGER NOT NULL,   -- points accrued (positive) or redeemed (negative)
  type TEXT NOT NULL CHECK (type IN ('accrue', 'redeem')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_id ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Enable RLS for transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies for transactions
DROP POLICY IF EXISTS "Cashiers can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Cashiers can view transactions they created" ON transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;

-- Authenticated users (cashiers) can insert transactions
CREATE POLICY "Cashiers can insert transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = cashier_id);

-- Cashiers can view transactions they created
CREATE POLICY "Cashiers can view transactions they created" ON transactions
  FOR SELECT USING (auth.uid() = cashier_id);

-- =============================================================================
-- 3. Verification queries
-- =============================================================================
-- Check tables were created
SELECT 'app_settings' as table_name, COUNT(*) as row_count FROM app_settings
UNION ALL
SELECT 'transactions' as table_name, COUNT(*) as row_count FROM transactions;

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('app_settings', 'transactions');
