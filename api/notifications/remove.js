// api/notifications/remove.js
// Vercel Serverless Function for removing promo from cards
// This clears the promo_message from issued_cards and triggers pass update

const { createClient } = require('@supabase/supabase-js');
const apn = require('node-apn');
const apnProvider = require('../../lib/apn');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const PASS_TYPE_IDENTIFIER = process.env.PASS_TYPE_IDENTIFIER;

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
        console.log('Authenticated user for promo removal:', userId);

        // =========================================================================
        // 2. INPUT VALIDATION
        // =========================================================================
        const { campaign_id } = req.body || {};

        if (!campaign_id) {
            return res.status(400).json({ error: 'Campaign ID is required' });
        }

        // =========================================================================
        // 3. VERIFY CAMPAIGN OWNERSHIP
        // =========================================================================
        const serviceSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { persistSession: false }
        });

        const { data: campaign, error: campaignError } = await serviceSupabase
            .from('marketing_campaigns')
            .select('id, sent_by, show_on_card')
            .eq('id', campaign_id)
            .single();

        if (campaignError || !campaign) {
            console.error('Campaign not found:', campaignError);
            return res.status(404).json({ error: 'Кампания не найдена' });
        }

        if (campaign.sent_by !== userId) {
            return res.status(403).json({ error: 'Нет доступа к этой кампании' });
        }

        // =========================================================================
        // 4. GET ALL CARDS BELONGING TO THIS BUSINESS
        // =========================================================================
        const { data: templates, error: templatesError } = await serviceSupabase
            .from('card_templates')
            .select('id')
            .eq('user_id', userId);

        if (templatesError || !templates || templates.length === 0) {
            console.log('No templates found for this business');
            return res.status(200).json({ status: 'ok', message: 'Нет карт для обновления' });
        }

        const templateIds = templates.map(t => t.id);

        const { data: issuedCards, error: cardsError } = await serviceSupabase
            .from('issued_cards')
            .select('uuid')
            .in('card_template_id', templateIds);

        if (cardsError || !issuedCards || issuedCards.length === 0) {
            console.log('No issued cards found');
            return res.status(200).json({ status: 'ok', message: 'Нет карт для обновления' });
        }

        const cardUuids = issuedCards.map(c => c.uuid);

        // =========================================================================
        // 5. CLEAR PROMO FROM ALL CARDS
        // =========================================================================
        const { error: updateError } = await serviceSupabase
            .from('issued_cards')
            .update({
                promo_message: null,
                promo_updated_at: null,
                updated_at: new Date().toISOString()
            })
            .in('uuid', cardUuids);

        if (updateError) {
            console.error('Failed to clear promo:', updateError);
            return res.status(500).json({ error: 'Не удалось очистить акцию' });
        }

        console.log(`✅ Cleared promo from ${cardUuids.length} cards`);

        // =========================================================================
        // 6. UPDATE CAMPAIGN TO MARK AS NOT ON CARD
        // =========================================================================
        await serviceSupabase
            .from('marketing_campaigns')
            .update({ show_on_card: false })
            .eq('id', campaign_id);

        // =========================================================================
        // 7. SEND PUSH TO UPDATE CARDS
        // =========================================================================
        const { data: devices } = await serviceSupabase
            .from('pass_devices')
            .select('push_token')
            .in('serial_number', cardUuids)
            .not('push_token', 'is', null);

        if (devices && devices.length > 0) {
            const tokens = [...new Set(devices.map(d => d.push_token).filter(Boolean))];

            if (tokens.length > 0 && apnProvider) {
                const notification = new apn.Notification();
                notification.topic = PASS_TYPE_IDENTIFIER;
                notification.payload = {};

                try {
                    const response = await apnProvider.send(notification, tokens);
                    console.log(`📱 Push sent to ${response.sent?.length || 0} devices to refresh cards`);
                } catch (pushErr) {
                    console.error('Push error:', pushErr);
                }
            }
        }

        // =========================================================================
        // 8. RETURN SUCCESS
        // =========================================================================
        return res.status(200).json({
            status: 'ok',
            message: 'Акция удалена с карт',
            cards_updated: cardUuids.length
        });

    } catch (err) {
        console.error('Remove promo error:', err);
        return res.status(500).json({
            error: 'Internal Server Error',
            detail: String(err.message || err)
        });
    }
};
