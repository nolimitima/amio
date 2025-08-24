# Сводка изменений для Apple Wallet .pkpass

## ✅ Что исправлено/добавлено

### 1. Dashboard.jsx
- **qr_value**: теперь содержит `uuid` вместо URL
- **previewUrl**: по-прежнему строится как `${origin}/card/${uuid}` для предпросмотра
- **pkpassUrl**: строится как `${origin}/api/passes/${uuid}` для скачивания

### 2. API endpoint (/api/passes/[uuid].js)
- **Фолбэк для ENV**: добавлен `VITE_` префикс для локальной разработки
- **Чтение данных**: читает `issued_cards` + `card_templates`
- **Конвертация цветов**: hex → rgb() для Apple Wallet
- **Ассеты**: подтягивает логотип/обложку из шаблона
- **pass.json**: полная структура storeCard с обязательными полями

### 3. Структура данных
- **issued_cards.qr_value**: содержит `uuid` (payload для сканера)
- **CardPreview.jsx**: QR код содержит URL для предпросмотра
- **Все поля**: соответствуют требованиям Apple Wallet

## 🔧 Логика работы

1. **Выдача карты**: `qr_value = uuid` (короткий payload)
2. **Предпросмотр**: QR содержит `${origin}/card/${uuid}` (URL)
3. **Скачивание .pkpass**: `${origin}/api/passes/${uuid}`
4. **Wallet**: получает `uuid` в barcode.message

## 📋 Требования Apple Wallet

✅ **Обязательные поля pass.json:**
- formatVersion, passTypeIdentifier, teamIdentifier
- organizationName, description, serialNumber
- storeCard.primaryFields (минимум 1)
- storeCard.barcode

✅ **Обязательные ассеты:**
- icon.png (87×87), icon@2x.png (174×174)

## 🚀 Следующие шаги

1. **Redeploy в Vercel** с Clear build cache
2. **Проверить**: Functions → `/api/passes/[uuid]` показывает новый код
3. **Тестировать**: выдать карту → скачать .pkpass → добавить в Wallet

## 📁 Файлы изменены

- `frontend/src/pages/Dashboard.jsx` - qr_value = uuid
- `api/passes/[uuid].js` - полная генерация .pkpass
- `DEPLOY_INSTRUCTIONS.md` - инструкция по деплою
- `TABLE_SCHEMA.md` - схема таблиц
- `CHANGES_SUMMARY.md` - эта сводка
