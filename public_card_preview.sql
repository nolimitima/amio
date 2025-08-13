-- Публичное превью карты по uuid через SECURITY DEFINER
-- Выполнить в Supabase SQL Editor

-- На всякий случай расширение для gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Функция возвращает безопасный набор полей по uuid
CREATE OR REPLACE FUNCTION public.get_issued_card_by_uuid(p_uuid uuid)
RETURNS TABLE (
  id INTEGER,
  uuid UUID,
  guest_name TEXT,
  balance INTEGER,
  email TEXT,
  phone TEXT,
  card_template_id INTEGER
) AS $$
  SELECT
    ic.id,
    ic.uuid,
    ic.guest_name,
    ic.balance,
    ic.email,
    ic.phone,
    ic.card_template_id
  FROM public.issued_cards ic
  WHERE ic.uuid = p_uuid
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Даем право вызывать функцию анонимным и аутентифицированным
GRANT EXECUTE ON FUNCTION public.get_issued_card_by_uuid(uuid) TO anon, authenticated;
