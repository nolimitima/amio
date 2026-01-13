-- Проверка существующих таблиц и данных
-- Выполните этот скрипт в SQL Editor, чтобы понять, что уже есть

-- 1. Какие таблицы существуют?
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Проверяем структуру card_templates (если существует)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'card_templates'
ORDER BY ordinal_position;

-- 3. Проверяем структуру issued_cards (если существует)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'issued_cards'
ORDER BY ordinal_position;

-- 4. Проверяем storage buckets
SELECT id, name, public FROM storage.buckets;

-- 5. Проверяем политики RLS для существующих таблиц
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public';

-- 6. Проверяем политики storage
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'storage';
