

# ✅ Правильная настройка Push-обновлений Apple Wallet (PassKit)

Это руководство описывает полную настройку бэкенда для поддержки real-time push-обновлений карт Apple Wallet.

**Главный принцип:** Для Apple Wallet используется **ТОЛЬКО ОДИН** сертификат типа `Pass Type ID` как для подписи `.pkpass` файла, так и для отправки push-уведомлений (APN).

-----

## 1\. Переменные окружения (Vercel)

Убедись, что в твоем проекте Vercel установлены **только** эти переменные.

```bash
# --- Переменные Supabase ---
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE=your_service_role_key

# --- Переменные Apple ---
# ЕДИНСТВЕННЫЙ сертификат Pass Type ID, закодированный в base64
PASS_P12_BASE64=your_pass_p12_certificate_base64 
# Пароль от этого .p12 файла
PASS_P12_PASSWORD=your_pass_p12_password
# Идентификатор (напр., pass.com.amian)
PASS_TYPE_IDENTIFIER=pass.com.yourcompany
# 10-значный ID твоей команды Apple Developer
TEAM_IDENTIFIER=your_apple_team_id
# Промежуточный WWDR сертификат (в base64)
WWDR_CERT_BASE64=your_wwdr_certificate_base64

# --- Переменные проекта ---
# Публичный URL твоего Vercel-приложения
PUBLIC_BASE_URL=https://your-domain.vercel.app
# Секретный токен для проверки запросов от Apple
AUTH_TOKEN=your_secret_authentication_token
# Название твоей организации
ORG_NAME=Amian
```

### ❗️ Важное действие

Удали эти **старые и ненужные** переменные из Vercel, чтобы они не вызывали путаницы:

  * `PASSKIT_APNS_P12_BASE64` (УДАЛИТЬ)
  * `PASSKIT_APNS_P12_PASSWORD` (УДАЛИТЬ)

-----

## 2\. Настройка ЕДИНОГО сертификата (Pass Type ID)

1.  Войди в **Apple Developer Portal** -\> **Certificates, Identifiers & Profiles**.
2.  **Identifiers:** Создай `Pass Type ID` (например, `pass.com.amian`).
3.  **Certificates:** Нажми `(+)` и создай **ОДИН** сертификат типа **`Pass Type ID Certificate`**. Выбери `Pass Type ID`, который ты создал на шаге 2.
4.  Загрузи `.certSigningRequest` (CSR) файл, созданный через **"Связку ключей"** (Keychain Access) на твоем Mac.
5.  Скачай сгенерированный `.cer` файл и установи его в "Связку ключей".
6.  **В Связке ключей:** Найди этот сертификат. Нажми на стрелку, чтобы раскрыть его.
7.  **Экспорт:** Выдели **и сам сертификат, и приватный ключ под ним**. Нажми правой кнопкой -\> "Экспортировать 2 объекта..." -\> выбери формат `.p12`. Придумай пароль.
8.  **Конвертация в Base64:**
      * Открой Терминал и выполни команду:
        ```bash
        base64 -i /путь/к/твоему/файлу.p12 -o cert.base64
        ```
      * Открой `cert.base64` и скопируй все содержимое.
9.  **Vercel:** Вставь эту `base64` строку в `PASS_P12_BASE64`. Пароль от `.p12` вставь в `PASS_P12_PASSWORD`.

-----

## 3\. Настройка базы данных Supabase (Таблицы)

Выполни эти SQL-запросы в **SQL Editor** твоего проекта Supabase.

### Таблица `issued_cards`

Добавляем `auth_token` (для безопасности) и `updated_at` (для отслеживания обновлений).

```sql
-- Добавляем колонку auth_token, если ее нет
ALTER TABLE public.issued_cards
ADD COLUMN IF NOT EXISTS auth_token TEXT;

CREATE INDEX IF NOT EXISTS idx_issued_cards_auth_token ON public.issued_cards(auth_token);

-- Добавляем колонку updated_at, если ее нет
ALTER TABLE public.issued_cards
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;
```

### Таблица `pass_devices`

Эта таблица будет хранить `pushToken`'ы всех устройств.

```sql
CREATE TABLE IF NOT EXISTS public.pass_devices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_library_identifier TEXT,
  push_token TEXT,
  pass_type_identifier TEXT,
  serial_number TEXT, -- Используй TEXT, если твои serialNumber это UUID
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(device_library_identifier, pass_type_identifier, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_pass_devices_serial_number ON public.pass_devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_pass_devices_device_library ON public.pass_devices(device_library_identifier);
```

-----

## 4\. КРИТИЧЕСКИЙ ШАГ: Триггер `updated_at`

Этот код **автоматически** обновляет поле `updated_at` в `issued_cards` каждый раз, когда ты меняешь баланс. Без этого телефон не узнает, что карта обновилась.

Выполни это в **SQL Editor** Supabase:

```sql
-- 1. Создаем функцию-триггер
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Удаляем старый триггер (на всякий случай)
DROP TRIGGER IF EXISTS on_issued_cards_updated ON public.issued_cards;

-- 3. Применяем новый триггер к твоей таблице
CREATE TRIGGER on_issued_cards_updated
BEFORE UPDATE ON public.issued_cards
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();
```

-----

## 5\. API Endpoints (Протокол PassKit)

Твой код теперь должен обслуживать 4 эндпоинта по пути `/api/passkit/v1/...`

1.  **`POST .../registrations/[passTypeIdentifier]/[serialNumber]`**

      * **Что делает:** Вызывается телефоном **1 раз** при добавлении карты. Сохраняет `pushToken` в `pass_devices`.

2.  **`DELETE .../registrations/[passTypeIdentifier]/[serialNumber]`**

      * **Что делает:** Вызывается телефоном при удалении карты. Удаляет `pushToken` из `pass_devices`.

3.  **`GET .../registrations/[passTypeIdentifier]` (БЕЗ `serialNumber`)**

      * **Что делает:** Вызывается телефоном **после** получения push-уведомления. Телефон спрашивает: "Какие карты (`serialNumbers`) обновились с `[прошлое время]`?".

4.  **`GET .../passes/[passTypeIdentifier]/[serialNumber]`**

      * **Что делает:** Вызывается телефоном **после** шага 3. Телефон запрашивает конкретный `.pkpass` файл с новым балансом.

-----

## 6\. Тестирование

1.  Убедись, что все переменные окружения (Шаг 1) и триггер (Шаг 4) применены.
2.  Задеплой код (Vercel).
3.  Удали старую карту Amian с телефона.
4.  Установи карту заново (просканируй QR-код).
5.  Проверь логи Vercel: ты должен увидеть `POST` запрос на `.../registrations/...` (Это значит, `pushToken` сохранился).
6.  Вызови свой эндпоинт для обновления баланса (например, `api/scanner/scan.js`).
7.  Проверь логи Vercel: ты должен увидеть:
      * "APN Push Sent..."
      * `GET` запрос на `.../registrations/...` (Телефон спрашивает, что обновилось).
      * `GET` запрос на `.../passes/...` (Телефон забирает новую карту).
8.  Смотри на экран телефона: баланс на карте должен обновиться.