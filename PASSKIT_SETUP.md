# Настройка Push-обновлений Apple Wallet (PassKit)

## Переменные окружения

Добавьте следующие переменные в Vercel (или в ваш .env файл для локальной разработки):

### Обязательные переменные:
```bash
# Существующие переменные (уже должны быть настроены)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE=your_service_role_key
PASS_P12_BASE64=your_pass_p12_certificate_base64
PASS_P12_PASSWORD=your_pass_p12_password
PASS_TYPE_IDENTIFIER=pass.com.yourcompany
TEAM_IDENTIFIER=your_apple_team_id
ORG_NAME=Your Company Name
WWDR_CERT_BASE64=your_wwdr_certificate_base64

# Новые переменные для push-уведомлений
PUBLIC_BASE_URL=https://your-domain.vercel.app
PASSKIT_APNS_P12_BASE64=your_apns_p12_certificate_base64
PASSKIT_APNS_P12_PASSWORD=your_apns_p12_password
```

## Настройка APNs сертификата

1. Войдите в Apple Developer Portal
2. Перейдите в Certificates, Identifiers & Profiles
3. Создайте новый сертификат типа "Apple Push Notification service SSL (Sandbox & Production)"
4. Скачайте сертификат и конвертируйте в P12:
   ```bash
   # Конвертация .cer в .p12
   openssl x509 -in certificate.cer -inform DER -out certificate.pem -outform PEM
   openssl pkcs12 -export -out apns.p12 -inkey private_key.pem -in certificate.pem
   ```
5. Конвертируйте P12 в base64:
   ```bash
   base64 -i apns.p12 -o apns.p12.base64
   ```
6. Скопируйте содержимое файла `apns.p12.base64` в переменную `PASSKIT_APNS_P12_BASE64`

## Создание таблицы в Supabase

Выполните SQL-запрос из файла `create_pass_devices_table.sql`:

```sql
create table pass_devices (
  id bigint generated always as identity primary key,
  device_library_identifier text,
  push_token text,
  pass_type_identifier text,
  serial_number uuid references issued_cards(uuid),
  created_at timestamptz default now(),
  unique(device_library_identifier, pass_type_identifier, serial_number)
);

create index idx_pass_devices_serial_number on pass_devices(serial_number);
create index idx_pass_devices_device_library on pass_devices(device_library_identifier);
create index idx_pass_devices_push_token on pass_devices(push_token);
```

## Добавление поля auth_token в таблицу issued_cards

Если поле `auth_token` еще не существует в таблице `issued_cards`, добавьте его:

```sql
ALTER TABLE issued_cards ADD COLUMN auth_token text;
CREATE INDEX idx_issued_cards_auth_token ON issued_cards(auth_token);
```

## Тестирование

1. Деплойте изменения в Vercel
2. Установите карту в Apple Wallet на iPhone
3. Отсканируйте QR-код карты через `/api/scanner/scan.js` с действием `redeem` или `add_bonus`
4. Проверьте, что карта обновилась в Apple Wallet

## API Endpoints

Созданы следующие endpoints для PassKit:

- `PUT /api/passkit/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber]` - регистрация устройства
- `DELETE /api/passkit/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber]` - удаление устройства
- `GET /api/passkit/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]` - список измененных карт
- `GET /api/passkit/v1/passes/[passTypeIdentifier]/[serialNumber]` - получение обновленной карты

## Логирование

Push-уведомления логируются в консоль Vercel. Проверьте логи для отладки:

```bash
vercel logs
```

## Безопасность

- `auth_token` генерируется автоматически для каждой карты
- Все API endpoints требуют валидный `Authorization: ApplePass <auth_token>` заголовок
- Push-уведомления отправляются только на зарегистрированные устройства
