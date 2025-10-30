// lib/apn.js
// Общий APNs провайдер (HTTP/2) для PassKit, использует тот же p12, что и подпись .pkpass

const apn = require('node-apn');

const PASS_P12_BASE64 = process.env.PASS_P12_BASE64;
const PASS_P12_PASSWORD = process.env.PASS_P12_PASSWORD || '';
const PASS_TYPE_IDENTIFIER = process.env.PASS_TYPE_IDENTIFIER;
const WWDR_CERT_BASE64 = process.env.WWDR_CERT_BASE64 || '';

if (!PASS_P12_BASE64) throw new Error('PASS_P12_BASE64 missing');
if (!PASS_TYPE_IDENTIFIER) throw new Error('PASS_TYPE_IDENTIFIER missing');

const pfx = Buffer.from(PASS_P12_BASE64, 'base64');
let ca;
try {
  if (WWDR_CERT_BASE64) {
    const wwdrBuf = Buffer.from(WWDR_CERT_BASE64, 'base64');
    // Если пришёл не base64, падать не будем, node-apn сам справится без ca
    if (wwdrBuf && wwdrBuf.length > 0) {
      ca = [wwdrBuf];
    }
  }
} catch {}

const providerOptions = {
  pfx,
  passphrase: PASS_P12_PASSWORD,
  production: true,
  // topic можно указывать на нотификации; укажем и тут для явности
  // Некоторые окружения ожидают его на уровне нотификации, но это не мешает
  // тут иметь значение по умолчанию.
  // node-apn проигнорирует неизвестные поля, так что безопасно.
};

if (ca) providerOptions.ca = ca;

const apnProvider = new apn.Provider(providerOptions);

module.exports = apnProvider;


