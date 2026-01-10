-- Migration: Add subscription_status to profiles table for Manual Approval System
-- Run this in your Supabase SQL Editor

-- 1. Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_status TEXT DEFAULT 'pending' NOT NULL,
  trial_started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add the column if the table already exists (safe to run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_status TEXT DEFAULT 'pending' NOT NULL;
  END IF;
END $$;

-- 3. Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- 5. Create RLS policies
-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (but not subscription_status - that's admin only)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 6. Create trigger function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, subscription_status, created_at, updated_at)
  VALUES (NEW.id, 'pending', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 7. Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 8. Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. CRITICAL: Set ALL existing users to 'active' to prevent lockout
-- This ensures current admin/owner accounts retain full access
INSERT INTO profiles (id, subscription_status, created_at, updated_at)
SELECT id, 'active', NOW(), NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO UPDATE SET subscription_status = 'active', updated_at = NOW();

-- Also update any existing profiles that might have null status
UPDATE profiles SET subscription_status = 'active' WHERE subscription_status IS NULL OR subscription_status = '';

-- 10. Verify the migration
SELECT 
  'Migration complete' AS status,
  COUNT(*) AS total_profiles,
  COUNT(*) FILTER (WHERE subscription_status = 'active') AS active_users,
  COUNT(*) FILTER (WHERE subscription_status = 'pending') AS pending_users
FROM profiles;
