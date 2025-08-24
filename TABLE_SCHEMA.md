# Схема таблиц для Apple Wallet .pkpass

## card_templates (создание шаблона в Dashboard.jsx)

| Поле | Тип | Описание | Использование в .pkpass |
|------|-----|----------|------------------------|
| `user_facing_name` | text | Название карты | `description`, `storeCard.headerFields[0].value` |
| `logo_url` | text | URL логотипа | `logo.png` (если есть) |
| `cover_url` | text | URL обложки | `background.png` (если есть) |
| `bg_color` | text | Цвет фона (hex) | `backgroundColor` (конвертируется в rgb) |
| `label_color` | text | Цвет лейблов (hex) | `labelColor` (конвертируется в rgb) |
| `value_color` | text | Цвет значений (hex) | `foregroundColor` (конвертируется в rgb) |
| `description` | text | Описание карты | `storeCard.backFields[0]` |
| `contact_email` | text | Email поддержки | `storeCard.backFields[2]` |
| `contact_phone` | text | Телефон поддержки | `storeCard.backFields[3]` |
| `website_url` | text | Сайт компании | `storeCard.backFields[1]` |

## issued_cards (выдача карты в handleIssueCard)

| Поле | Тип | Описание | Использование в .pkpass |
|------|-----|----------|------------------------|
| `uuid` | uuid | Уникальный ID карты | `serialNumber` (обязательно для Wallet) |
| `guest_name` | text | Имя гостя | `storeCard.primaryFields[0].value` |
| `email` | text | Email гостя | `storeCard.secondaryFields[1].value` |
| `phone` | text | Телефон гостя | `storeCard.auxiliaryFields[0].value` |
| `balance` | numeric | Баланс карты | `storeCard.secondaryFields[0].value` |
| `qr_value` | text | **ВАЖНО: payload (uuid), не URL** | `storeCard.barcode.message` |
| `card_template_id` | uuid | Ссылка на шаблон | Для чтения `card_templates` |

## issued_cards_public (в CardPreview.jsx)

| Поле | Тип | Описание | Использование |
|------|-----|----------|---------------|
| `uuid` | uuid | ID карты | Для построения URL предпросмотра |
| `guest_name` | text | Имя гостя | Отображение в превью |
| `balance` | numeric | Баланс | Отображение в превью |
| `phone` | text | Телефон | Отображение в превью |
| `email` | text | Email | Отображение в превью |

## Требования Apple Wallet (storeCard)

✅ **Обязательные поля:**
- `formatVersion: 1`
- `passTypeIdentifier` (из ENV)
- `teamIdentifier` (из ENV)  
- `organizationName` (из ENV)
- `description` (из `user_facing_name`)
- `serialNumber` (из `uuid`)

✅ **Обязательные секции:**
- `storeCard.primaryFields` (минимум 1 поле)
- `storeCard.barcode` (QR с `qr_value`)

✅ **Обязательные ассеты:**
- `icon.png` (87×87 px)
- `icon@2x.png` (174×174 px)

## Логика работы

1. **Dashboard.jsx**: `qr_value = uuid` (не URL)
2. **API endpoint**: читает `issued_cards` + `card_templates`
3. **pass.json**: собирается из обеих таблиц
4. **CardPreview.jsx**: строит URL для предпросмотра: `${origin}/card/${uuid}`
5. **QR код**: содержит `uuid` для сканера, не URL
