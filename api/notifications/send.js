// api/notifications/send.js
// Vercel Serverless Function for sending marketing push notifications
// With REAL Apple Push Notification Service integration

const { createClient } = require('@supabase/supabase-js');
const apn = require('node-apn');
const apnProvider = require('../../lib/apn');  // Use shared APNs provider

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const PASS_TYPE_IDENTIFIER = process.env.PASS_TYPE_IDENTIFIER;

// Simple XSS sanitizer for server-side
function sanitizeInput(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .trim();
}

// Send push notifications to devices belonging to THIS business only
async function sendPushNotifications(serviceSupabase, userId, title, body, targetAudience, showOnCard = false) {
    const results = {
        sent: 0,
        failed: 0,
        errors: [],
        skipped: false
    };

    // Check if APNs is configured
    if (!process.env.PASS_P12_BASE64) {
        console.warn('⚠️ PASS_P12_BASE64 not configured, skipping push notifications');
        results.skipped = true;
        return results;
    }

    try {
        // =========================================================================
        // MULTI-TENANT ISOLATION: Only get devices for THIS business's cards
        // Chain: user_id (business) -> card_templates -> issued_cards -> pass_devices
        // =========================================================================

        // Step 1: Get all card_template IDs belonging to this business
        const { data: templates, error: templatesError } = await serviceSupabase
            .from('card_templates')
            .select('id')
            .eq('user_id', userId);

        if (templatesError) {
            console.error('Failed to fetch templates:', templatesError);
            results.errors.push('Database error fetching templates');
            return results;
        }

        if (!templates || templates.length === 0) {
            console.log('📭 No card templates found for this business');
            return results;
        }

        const templateIds = templates.map(t => t.id);
        console.log(`📋 Found ${templateIds.length} card template(s) for this business`);

        // Step 2: Get all issued_cards UUIDs for these templates
        const { data: issuedCards, error: cardsError } = await serviceSupabase
            .from('issued_cards')
            .select('uuid')
            .in('card_template_id', templateIds);

        if (cardsError) {
            console.error('Failed to fetch issued cards:', cardsError);
            results.errors.push('Database error fetching issued cards');
            return results;
        }

        if (!issuedCards || issuedCards.length === 0) {
            console.log('📭 No issued cards found for this business');
            return results;
        }

        const cardUuids = issuedCards.map(c => c.uuid);
        console.log(`� Found ${cardUuids.length} issued card(s) for this business`);

        // Step 3: Get push tokens for devices registered to THESE cards only
        // pass_devices.serial_number = issued_cards.uuid
        const { data: devices, error: devicesError } = await serviceSupabase
            .from('pass_devices')
            .select('push_token')
            .in('serial_number', cardUuids)
            .not('push_token', 'is', null);

        if (devicesError) {
            console.error('Failed to fetch devices:', devicesError);
            results.errors.push('Database error fetching devices');
            return results;
        }

        if (!devices || devices.length === 0) {
            console.log('📭 No registered devices found for this business');
            return results;
        }

        // Get unique push tokens
        const tokens = [...new Set(devices.map(d => d.push_token).filter(Boolean))];
        console.log(`📱 Found ${tokens.length} unique device token(s) for this business`);

        // Log target audience
        if (targetAudience === 'test') {
            console.log('📱 Target audience: TEST GROUP (sending to all business devices for now)');
        } else {
            console.log('📱 Target audience: ALL CLIENTS of this business');
        }

        if (tokens.length === 0) {
            return results;
        }

        // =========================================================================
        // CRITICAL: Update issued_cards with promo message + timestamp
        // We ALWAYS set promo_message because it's needed for changeMessage banner
        // But we use 'promo_show_on_card' flag to control if it displays on the card
        // =========================================================================
        const { error: updateError } = await serviceSupabase
            .from('issued_cards')
            .update({
                updated_at: new Date().toISOString(),
                promo_message: body,  // Always set for changeMessage notification banner
                promo_updated_at: new Date().toISOString(),
                promo_show_on_card: showOnCard  // Controls visibility on card
            })
            .in('uuid', cardUuids);

        if (updateError) {
            console.error('Failed to update issued_cards:', updateError);
        } else {
            if (showOnCard) {
                console.log(`📅 Updated ${cardUuids.length} card(s) with VISIBLE promo`);
            } else {
                console.log(`📅 Updated ${cardUuids.length} card(s) - notification only (hidden on card)`);
            }
        }

        // Use shared APNs provider from lib/apn.js

        // =========================================================================
        // APPLE WALLET PUSH FORMAT:
        // - MUST use EMPTY payload `{}` for pass updates
        // - This tells Wallet "hey, check for updates"
        // - Wallet then calls GET /passkit/v1/devices/.../registrations/...
        // - If updated_at changed, Wallet fetches new .pkpass
        // - The notification banner appears via `changeMessage` in pass.json fields
        // =========================================================================
        const notification = new apn.Notification();
        notification.topic = PASS_TYPE_IDENTIFIER;  // Required for Wallet
        notification.payload = {};  // EMPTY payload triggers pass update flow

        // 4. Send to all tokens
        console.log('🚀 Sending push notifications...');
        const response = await apnProvider.send(notification, tokens);

        // 5. Process results
        if (response.sent && response.sent.length > 0) {
            results.sent = response.sent.length;
            console.log(`✅ Successfully sent to ${results.sent} device(s)`);
        }

        if (response.failed && response.failed.length > 0) {
            results.failed = response.failed.length;
            console.error(`❌ Failed to send to ${results.failed} device(s):`);
            response.failed.forEach(failure => {
                console.error(`  - Device: ${failure.device}, Error: ${failure.response?.reason || 'Unknown'}`);
                results.errors.push(failure.response?.reason || 'Unknown error');
            });
        }

        // Note: Don't shutdown shared apnProvider

    } catch (err) {
        console.error('Push notification error:', err);
        results.errors.push(err.message);
    }

    return results;
}

module.exports = async (req, res) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // Check environment variables
    if (!SUPABASE_URL || !SERVICE_KEY) {
        console.error('Missing Supabase environment variables');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    try {
        // =========================================================================
        // 1. AUTHENTICATION CHECK
        // =========================================================================
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing authorization header' });
        }

        const token = authHeader.split(' ')[1];

        // Create Supabase client with user's JWT
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { persistSession: false },
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        });

        // Verify the session and get user
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            console.error('Auth error:', authError);
            return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
        }

        const userId = user.id;
        console.log('Authenticated user for notification send:', userId);

        // =========================================================================
        // 2. INPUT VALIDATION
        // =========================================================================
        const { title, body, target_audience, show_on_card } = req.body || {};
        const showOnCard = show_on_card === true;

        // Validate and sanitize title
        const sanitizedTitle = sanitizeInput(title);
        if (!sanitizedTitle || sanitizedTitle.length === 0) {
            return res.status(400).json({ error: 'Заголовок обязателен' });
        }
        if (sanitizedTitle.length > 100) {
            return res.status(400).json({ error: 'Заголовок слишком длинный (макс. 100 символов)' });
        }

        // Validate and sanitize body
        const sanitizedBody = sanitizeInput(body);
        if (!sanitizedBody || sanitizedBody.length === 0) {
            return res.status(400).json({ error: 'Текст сообщения обязателен' });
        }
        if (sanitizedBody.length > 500) {
            return res.status(400).json({ error: 'Текст слишком длинный (макс. 500 символов)' });
        }

        // Validate target_audience
        const validTargets = ['all', 'test'];
        const targetValue = validTargets.includes(target_audience) ? target_audience : 'all';

        // =========================================================================
        // 3. INSERT CAMPAIGN INTO DATABASE
        // =========================================================================
        const serviceSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { persistSession: false }
        });

        const { data: campaign, error: insertError } = await serviceSupabase
            .from('marketing_campaigns')
            .insert([{
                title: sanitizedTitle,
                body: sanitizedBody,
                status: 'sent',
                target_audience: targetValue,
                show_on_card: showOnCard,
                sent_by: userId
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Database insert error:', insertError);
            return res.status(500).json({ error: 'Не удалось сохранить рассылку' });
        }

        console.log('Campaign created:', campaign.id);

        // =========================================================================
        // 4. SEND REAL PUSH NOTIFICATIONS
        // =========================================================================
        console.log('='.repeat(60));
        console.log('📱 SENDING APPLE PUSH NOTIFICATIONS');
        console.log('='.repeat(60));

        const pushResults = await sendPushNotifications(
            serviceSupabase,
            userId,
            sanitizedTitle,
            sanitizedBody,
            targetValue,
            showOnCard
        );

        console.log('Push results:', pushResults);
        console.log('='.repeat(60));

        // =========================================================================
        // 5. RETURN SUCCESS
        // =========================================================================
        return res.status(200).json({
            status: 'ok',
            campaign_id: campaign.id,
            message: 'Рассылка успешно отправлена',
            push: {
                sent: pushResults.sent,
                failed: pushResults.failed,
                skipped: pushResults.skipped
            }
        });

    } catch (err) {
        console.error('Notification send error:', err);
        return res.status(500).json({
            error: 'Internal Server Error',
            detail: String(err.message || err)
        });
    }
};
