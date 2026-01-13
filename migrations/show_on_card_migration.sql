-- =============================================================================
-- Add Show on Card Feature to Marketing Campaigns
-- Run this in Supabase SQL Editor
-- =============================================================================

-- Add show_on_card column to marketing_campaigns
ALTER TABLE public.marketing_campaigns 
ADD COLUMN IF NOT EXISTS show_on_card boolean DEFAULT false;

-- Update RLS policy to allow authenticated users to update their own campaigns
DROP POLICY IF EXISTS "Authenticated can update own campaigns" ON marketing_campaigns;

CREATE POLICY "Authenticated can update own campaigns"
  ON marketing_campaigns FOR UPDATE
  TO authenticated
  USING (auth.uid() = sent_by)
  WITH CHECK (auth.uid() = sent_by);
