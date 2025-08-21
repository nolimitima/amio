// api/passes/[uuid].cjs  — CommonJS, чтобы Vercel точно подцепил
const { createClient } = require('@supabase/supabase-js');
const { PKPass } = require('passkit-generator');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const p12Buf = Buffer.from(process.env.PASS_P12_BASE64 || '', 'base64');
const p12Password = process.env.PASS_P12_PASSWORD || '';
const passTypeIdentifier = process.env.PASS_TYPE_IDENTIFIER;
const teamIdentifier = process.env.TEAM_IDENTIFIER;
const orgName = process.env.ORG_NAME || 'Amian';
const description = process.env.PASS_DESCRIPTION || 'Loyalty Card';
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.VITE_BASE_URL || '').replace(/\/$/, '');

async function bufFromUrl(url) {
  if (!url) return null;
  const r = await fetch(url);
  if (!r.ok) return null;
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

function hexToRgb(hex) {
  if (!hex) return 'rgb(0,0,0)';
  if (!hex.startsWith('#')) return hex;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r},${g},${b})`;
}

// Vercel (Node) serverless handler
module.exports = async (req, res) => {
  try {
    const { uuid } = req.query || {};
    if (!uuid) {
      res.status(400).send('Missing uuid');
      return;
    }

    // Карта (выдача)
    const { data: card, error: e1 } = await supabase
      .from('issued_cards')
      .select('uuid, guest_name, balance, email, phone, card_template_id')
      .eq('uuid', uuid)
      .single();

    if (e1 || !card) {
      res.status(404).send('Card not found');
      return;
    }

    // Шаблон
    const { data: tpl, error: e2 } = await supabase
      .from('card_templates')
      .select(
        'user_facing_name, logo_url, cover_url, bg_color, label_color, value_color, description, contact_email, contact_phone, website_url, max_uses'
      )
      .eq('id', card.card_template_id)
      .single();

    if (e2 || !tpl) {
      res.status(404).send('Template not found');
      return;
    }

    // Картинки
    const logoBuf = await bufFromUrl(tpl.logo_url);
    const iconBuf = logoBuf; // для MVP используем лого как icon (icon обязателен)
    const stripBuf = await bufFromUrl(tpl.cover_url);

    // Собираем pass
    const pass = await PKPass.from({
      model: {}, // пасс собираем целиком программно
      certificates: {
        wwdr: PKPass.defaultWWDRCA,
        signerCert: p12Buf,
        signerKey: { keyFile: p12Buf, passphrase: p12Password }
      },
      overrides: {
        formatVersion: 1,
        passTypeIdentifier,
        teamIdentifier,
        organizationName: orgName,
        description,
        serialNumber: String(card.uuid),

        // Цвета
        backgroundColor: hexToRgb(tpl.bg_color || '#10182B'),
        foregroundColor: hexToRgb(tpl.value_color || '#232323'),
        labelColor: hexToRgb(tpl.label_color || '#F1EFED'),

        // QR → ведёт на публичную карточку
        barcode: {
          format: 'PKBarcodeFormatQR',
          message: `${publicBaseUrl}/card/${card.uuid}`,
          messageEncoding: 'iso-8859-1'
        },

        // Тип — Store Card (loyalty)
        storeCard: {
          primaryFields: [
            { key: 'balance', label: 'БАЛАНС', value: `${card.balance ?? 0} B` }
          ],
          auxiliaryFields: [
            { key: 'guest', label: 'Гость', value: card.guest_name || 'Клиент' }
          ],
          backFields: [
            ...(tpl.description ? [{ key: 'desc', label: 'Описание', value: tpl.description }] : []),
            ...(tpl.contact_email ? [{ key: 'email', label: 'Email', value: tpl.contact_email }] : []),
            ...(tpl.contact_phone ? [{ key: 'phone', label: 'Телефон', value: tpl.contact_phone }] : []),
            ...(tpl.website_url ? [{ key: 'site', label: 'Сайт', value: tpl.website_url }] : [])
          ]
        }
      }
    });

    // Картинки, обязательные и опциональные
    if (iconBuf) {
      pass.images.add('icon.png', iconBuf);
      pass.images.add('icon@2x.png', iconBuf);
    }
    if (logoBuf) {
      pass.images.add('logo.png', logoBuf);
      pass.images.add('logo@2x.png', logoBuf);
    }
    if (stripBuf) {
      pass.images.add('strip.png', stripBuf);
    }

    const file = await pass.getAsBuffer();

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="card-${card.uuid}.pkpass"`);
    res.status(200).send(file);
  } catch (err) {
    console.error('[pkpass] error', err);
    res.status(500).send(err?.message || 'Internal Server Error');
  }
};
