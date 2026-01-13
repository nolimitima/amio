-- Проверка существования таблиц в Supabase
-- Выполните этот скрипт в SQL Editor

-- 1. Проверяем существование таблицы card_templates
SELECT 
  'card_templates' as table_name,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'card_templates') 
    THEN 'СУЩЕСТВУЕТ' 
    ELSE 'НЕ СУЩЕСТВУЕТ' 
  END as status;

-- 2. Проверяем существование таблицы issued_cards
SELECT 
  'issued_cards' as table_name,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'issued_cards') 
    THEN 'СУЩЕСТВУЕТ' 
    ELSE 'НЕ СУЩЕСТВУЕТ' 
  END as status;

-- 3. Проверяем количество записей в таблицах
SELECT 'card_templates' as table_name, COUNT(*) as row_count FROM card_templates
UNION ALL
SELECT 'issued_cards' as table_name, COUNT(*) as row_count FROM issued_cards;

-- 4. Проверяем storage buckets
SELECT id, name, public FROM storage.buckets WHERE id IN ('card-logos', 'card-covers');

-- 5. Проверяем политики RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('card_templates', 'issued_cards');

-- 6. Проверяем политики storage
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
