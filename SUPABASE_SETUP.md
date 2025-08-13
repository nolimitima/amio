# Настройка Supabase для проекта

## Таблицы

### user_profiles
```sql
-- Создание таблицы user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включение RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики (если есть)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for users based on their ID" ON user_profiles;
DROP POLICY IF EXISTS "Enable update for users based on their ID" ON user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_profiles;

-- Создаем политики с правильными названиями
-- Пользователи могут читать только свой профиль
CREATE POLICY "Enable read access for users based on their ID" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Пользователи могут обновлять только свой профиль
CREATE POLICY "Enable update for users based on their ID" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Пользователи могут создавать свой профиль
CREATE POLICY "Enable insert for authenticated users only" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Создание индекса для быстрого поиска по user_id
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
```

### card_templates
```sql
-- Создание таблицы card_templates
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

-- Включение RLS
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;

-- Политики для card_templates
CREATE POLICY "Users can view own cards" ON card_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards" ON card_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards" ON card_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cards" ON card_templates
  FOR DELETE USING (auth.uid() = user_id);
```

### issued_cards
```sql
-- Создание таблицы issued_cards
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

-- Включение RLS
ALTER TABLE issued_cards ENABLE ROW LEVEL SECURITY;

-- Политики для issued_cards
CREATE POLICY "Users can view own issued cards" ON issued_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own issued cards" ON issued_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own issued cards" ON issued_cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own issued cards" ON issued_cards
  FOR DELETE USING (auth.uid() = user_id);
```

## Storage Buckets

### card-logos
```sql
-- Создание bucket для логотипов карт
INSERT INTO storage.buckets (id, name, public) VALUES ('card-logos', 'card-logos', true);

-- Политики для card-logos
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'card-logos');
CREATE POLICY "Authenticated users can upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'card-logos' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own logos" ON storage.objects FOR UPDATE USING (bucket_id = 'card-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own logos" ON storage.objects FOR DELETE USING (bucket_id = 'card-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### card-covers  
```sql
-- Создание bucket для обложек карт
INSERT INTO storage.buckets (id, name, public) VALUES ('card-covers', 'card-covers', true);

-- Политики для card-covers
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'card-covers');
CREATE POLICY "Authenticated users can upload covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'card-covers' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own covers" ON storage.objects FOR UPDATE USING (bucket_id = 'card-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own covers" ON storage.objects FOR DELETE USING (bucket_id = 'card-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## Диагностика проблем

### Временное отключение RLS для тестирования
```sql
-- Отключить RLS для user_profiles
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Включить RLS обратно
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

### Проверка данных
```sql
-- Посмотреть все профили
SELECT * FROM user_profiles;

-- Посмотреть профиль конкретного пользователя
SELECT * FROM user_profiles WHERE user_id = '8e91227e-4947-4144-a81d-2fd5d5190ed6';

-- Посмотреть все карты
SELECT * FROM card_templates;

-- Посмотреть все выданные карты
SELECT * FROM issued_cards;
``` 