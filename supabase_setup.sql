-- Настройка Supabase для проекта Amian
-- Выполните эти команды в SQL Editor в Supabase Dashboard

-- 1. Создание таблицы card_templates
CREATE TABLE IF NOT EXISTS card_templates (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  internal_name TEXT NOT NULL,
  user_facing_name TEXT,
  logo_url TEXT,
  cover_url TEXT,
  bg_color TEXT,
  label_color TEXT,
  value_color TEXT,
  guest_name_field TEXT,
  bonus_percent_field TEXT,
  qr_value_field TEXT,
  description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  auto_update_balance BOOLEAN DEFAULT false,
  expires BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  notify_on_use BOOLEAN DEFAULT false,
  limit_uses BOOLEAN DEFAULT false,
  max_uses INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включение RLS для card_templates
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;

-- Политики для card_templates
DROP POLICY IF EXISTS "Users can view own cards" ON card_templates;
DROP POLICY IF EXISTS "Users can insert own cards" ON card_templates;
DROP POLICY IF EXISTS "Users can update own cards" ON card_templates;
DROP POLICY IF EXISTS "Users can delete own cards" ON card_templates;

CREATE POLICY "Users can view own cards" ON card_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards" ON card_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards" ON card_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cards" ON card_templates
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Создание таблицы issued_cards
CREATE TABLE IF NOT EXISTS issued_cards (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  card_template_id INTEGER REFERENCES card_templates(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  balance INTEGER DEFAULT 0,
  max_uses INTEGER,
  qr_value TEXT,
  uuid UUID UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включение RLS для issued_cards
ALTER TABLE issued_cards ENABLE ROW LEVEL SECURITY;

-- Политики для issued_cards
DROP POLICY IF EXISTS "Users can view own issued cards" ON issued_cards;
DROP POLICY IF EXISTS "Users can insert own issued cards" ON issued_cards;
DROP POLICY IF EXISTS "Users can update own issued cards" ON issued_cards;
DROP POLICY IF EXISTS "Users can delete own issued cards" ON issued_cards;

CREATE POLICY "Users can view own issued cards" ON issued_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own issued cards" ON issued_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own issued cards" ON issued_cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own issued cards" ON issued_cards
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Создание Storage Buckets
-- Удаляем существующие buckets если они есть
DELETE FROM storage.buckets WHERE id = 'card-logos';
DELETE FROM storage.buckets WHERE id = 'card-covers';

-- Создаем bucket для логотипов
INSERT INTO storage.buckets (id, name, public) VALUES ('card-logos', 'card-logos', true);

-- Создаем bucket для обложек
INSERT INTO storage.buckets (id, name, public) VALUES ('card-covers', 'card-covers', true);

-- 5. Политики для Storage (упрощенные для тестирования)
-- Удаляем старые политики
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload covers" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own covers" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own covers" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for logos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for covers" ON storage.objects;

-- Простые политики для card-logos
CREATE POLICY "Public Access for logos" ON storage.objects FOR SELECT USING (bucket_id = 'card-logos');
CREATE POLICY "Authenticated users can upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'card-logos' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'card-logos' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete logos" ON storage.objects FOR DELETE USING (bucket_id = 'card-logos' AND auth.role() = 'authenticated');

-- Простые политики для card-covers
CREATE POLICY "Public Access for covers" ON storage.objects FOR SELECT USING (bucket_id = 'card-covers');
CREATE POLICY "Authenticated users can upload covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'card-covers' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update covers" ON storage.objects FOR UPDATE USING (bucket_id = 'card-covers' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete covers" ON storage.objects FOR DELETE USING (bucket_id = 'card-covers' AND auth.role() = 'authenticated');

-- Проверка созданных таблиц
SELECT 'card_templates' as table_name, COUNT(*) as row_count FROM card_templates
UNION ALL
SELECT 'issued_cards' as table_name, COUNT(*) as row_count FROM issued_cards;
