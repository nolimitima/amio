# Инструкция по деплою и тестированию .pkpass

## Что сделано

✅ **Dashboard.jsx**: `qr_value` теперь содержит `uuid` вместо URL  
✅ **API endpoint**: `/api/passes/[uuid].js` полностью переписан для генерации .pkpass  
✅ **Обязательные ассеты**: `backend/pass-assets/icon.png` и `icon@2x.png` уже есть  
✅ **Зависимости**: `passkit-generator` и `@supabase/supabase-js` уже в package.json  

## Деплой

1. **Код уже закоммичен и запушен** в `main` ветку
2. **В Vercel**: 
   - Перейти в проект → Deployments
   - Нажать "Redeploy" с галочкой "Clear build cache"
   - Дождаться завершения деплоя

## Проверка деплоя

1. **В Vercel → Functions** открыть `/api/passes/[uuid]`
2. **Source** должен показывать новый код с `passkit-generator`
3. **НЕ должно быть** старого эхо-кода

## Тестирование

### 1. Выдача карты через UI
- Открыть Dashboard → "Выдача карты"
- Заполнить форму и выдать карту
- Проверить в `issued_cards`:
  - `qr_value` = `uuid` (не URL)
  - `card_template_id` заполнен

### 2. Скачивание .pkpass
- Открыть `https://<домен>/api/passes/<uuid>`
- Должен скачаться `card.pkpass`

### 3. Добавление в Apple Wallet
- Открыть `card.pkpass` на iPhone
- Нажать "Добавить в Wallet"

## Возможные ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `Missing asset icon.png` | Нет обязательных иконок | Проверить `backend/pass-assets/` |
| `Card not found` | Неправильный uuid | Проверить запись в `issued_cards` |
| `Template not found` | Нет `card_template_id` | Проверить связь с `card_templates` |
| `Invalid signature` | Проблемы с сертификатами | Проверить ENV: `PASS_P12_BASE64`, `PASS_P12_PASSWORD`, `PASS_TYPE_IDENTIFIER`, `TEAM_IDENTIFIER` |

## ENV переменные

Убедиться что в Vercel заданы:
- `PASS_P12_BASE64` - base64 сертификата
- `PASS_P12_PASSWORD` - пароль от сертификата  
- `PASS_TYPE_IDENTIFIER` - напр. "pass.com.amian"
- `TEAM_IDENTIFIER` - напр. "ABCDE12345"
- `SUPABASE_URL` и `SUPABASE_ANON_KEY`

## Структура .pkpass

Генерируется с данными из:
- **issued_cards**: имя, email, телефон, баланс, uuid
- **card_templates**: цвета, логотип, обложка, описание
- **QR код**: содержит `uuid` (не URL)
- **Ассеты**: icon.png, icon@2x.png + логотип/обложка из шаблона
