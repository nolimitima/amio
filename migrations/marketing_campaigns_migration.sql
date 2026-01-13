-- =============================================================================
-- Marketing Campaigns Table Migration
-- Run this in Supabase SQL Editor
-- =============================================================================

-- Create marketing_campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('sent', 'draft')),
  target_audience text NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'test')),
  created_at timestamptz DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SECURITY POLICIES (Zero Trust Architecture)
-- =============================================================================

-- Policy 1: Authenticated users can SELECT their org's campaigns
-- In a real multi-tenant system, you'd filter by organization_id
CREATE POLICY "Authenticated can select campaigns"
  ON marketing_campaigns FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: Authenticated users can INSERT new campaigns
-- The sent_by field MUST match the current user's auth.uid()
CREATE POLICY "Authenticated can insert campaigns"
  ON marketing_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sent_by);

-- Policy 3: Authenticated users can UPDATE their own campaigns (drafts only)
CREATE POLICY "Authenticated can update own campaigns"
  ON marketing_campaigns FOR UPDATE
  TO authenticated
  USING (auth.uid() = sent_by AND status = 'draft')
  WITH CHECK (auth.uid() = sent_by);

-- =============================================================================
-- IMPORTANT: No policies for 'anon' role = DENY ALL by default
-- Anonymous/public users cannot see or create any campaigns
-- =============================================================================

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created_at 
  ON marketing_campaigns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_sent_by 
  ON marketing_campaigns(sent_by);
