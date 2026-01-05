-- =============================================================================
-- Add Promo Message Column for Notification Banners
-- Run this in Supabase SQL Editor
-- =============================================================================

-- Add promo_message column to issued_cards
-- This will store the latest marketing message that triggers the notification banner
ALTER TABLE public.issued_cards 
ADD COLUMN IF NOT EXISTS promo_message TEXT DEFAULT NULL;

-- Add promo_updated_at to track when promo changed (for banner display)
ALTER TABLE public.issued_cards 
ADD COLUMN IF NOT EXISTS promo_updated_at TIMESTAMPTZ DEFAULT NULL;
