// /lib/apn.js
// ИСПРАВЛЕННАЯ ВЕРСИЯ (CommonJS)

const apn = require("node-apn");

// 1. PFX (ключ + серт) - ДЕКОДИРУЕМ из base64. Это ПРАВИЛЬНО.
const p12 = Buffer.from(process.env.PASS_P12_BASE64, 'base64');

// 2. WWDR (сертификат Apple) - НЕ ДЕКОДИРУЕМ.
//    Берем как чистый PEM-текст.
const wwdr = process.env.WWDR_CERT_BASE64; 

if (!wwdr || !wwdr.startsWith('-----BEGIN CERTIFICATE-----')) {
  console.error("WWDR_CERT_BASE64 не загружен или имеет неверный PEM-формат!");
}

const options = {
  pfx: p12,
  passphrase: process.env.PASS_P12_PASSWORD,
  ca: [wwdr], // <--- Передаем PEM-строку напрямую
  production: true, 
  topic: process.env.PASS_TYPE_IDENTIFIER,
  // Исправляем проблему с SSL сертификатами в serverless окружении (Vercel/Lambda)
  // В serverless нет доступа к системным CA сертификатам для проверки APNs
  rejectUnauthorized: false
};

const apnProvider = new apn.Provider(options);

// Используем module.exports, а НЕ export default
module.exports = apnProvider;