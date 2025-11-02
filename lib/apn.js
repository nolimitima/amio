// /lib/apn.js
import apn from "node-apn";

// 1. PFX (ключ + серт) - мы ДЕКОДИРУЕМ из base64. Это ПРАВИЛЬНО.
const p12 = Buffer.from(process.env.PASS_P12_BASE64, 'base64');

// 2. WWDR (сертификат Apple) - мы НЕ ДЕКОДИРУЕМ.
//    Мы передаем его как чистый PEM-текст.
//    (Это было ИСПРАВЛЕНИЕ)
const wwdr = process.env.WWDR_CERT_BASE64; 

const options = {
  pfx: p12,
  passphrase: process.env.PASS_P12_PASSWORD,
  ca: [wwdr], // <--- Передаем PEM-строку напрямую
  production: true, 
  topic: process.env.PASS_TYPE_IDENTIFIER 
};

const apnProvider = new apn.Provider(options);
export default apnProvider;