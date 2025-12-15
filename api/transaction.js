// api/transaction/route.js
// Vercel Serverless Function for POS Terminal transactions

const { createClient } = require('@supabase/supabase-js');
const apnProvider = require('../lib/apn');
const apn = require('node-apn');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const PASS_TYPE_IDENTIFIER = process.env.PASS_TYPE_IDENTIFIER;

// Helper: Smart Rounding (max 2 decimals, no trailing zeros)
// 64.525 → 64.53, 700.00 → 700
function smartRound(value) {
    return Math.round(value * 100) / 100;
}

// Helper: Send PassKit push notification to update the pass
async function sendPasskitPush(serialNumber) {
    try {
        if (!PASS_TYPE_IDENTIFIER) {
            console.log('PassKit topic not configured, skipping push...');
            return;
        }

        const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
        const { data: devices, error: devicesError } = await supa
            .from('pass_devices')
            .select('push_token')
            .eq('serial_number', serialNumber);

        if (devicesError || !devices || devices.length === 0) {
            console.log(`No registered devices found for card ${serialNumber}`);
            return;
        }

        const tokens = devices.map(d => d.push_token).filter(Boolean);
        if (tokens.length === 0) return;

        const notification = new apn.Notification();
        notification.topic = PASS_TYPE_IDENTIFIER;
        notification.payload = {}; // empty payload triggers pass update

        const response = await apnProvider.send(notification, tokens);
        if (response?.failed?.length) {
            console.error('APN Push Failed:', response.failed);
        }
        if (response?.sent?.length) {
            console.log(`APN Push Sent to ${response.sent.length} device(s) for card ${serialNumber}`);
        }
    } catch (err) {
        console.error('sendPasskitPush error:', err);
    }
}

module.exports = async (req, res) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // Check environment variables
    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ error: 'Server misconfigured: missing SUPABASE env vars' });
    }

    try {
        // Extract JWT token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
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
            return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
        }

        const cashier_id = user.id;

        // Parse and validate request body
        const { client_id, amount, action } = req.body || {};

        console.log('Transaction request:', { client_id, amount, action, amount_type: typeof amount });

        if (!client_id) {
            return res.status(400).json({ error: 'Missing required field: client_id' });
        }

        // Convert amount to number if it's a string
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

        if (!numAmount || typeof numAmount !== 'number' || isNaN(numAmount) || numAmount <= 0) {
            console.error('Invalid amount:', { amount, numAmount, type: typeof amount });
            return res.status(400).json({ error: 'Invalid amount: must be a positive number' });
        }

        if (!action || !['accrue', 'redeem'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action: must be "accrue" or "redeem"' });
        }

        // Use service role client for database operations
        const serviceSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { persistSession: false }
        });

        // Hardcoded fallback if card template has no bonus_percent_field
        // (This should rarely be used since all templates have bonus_percent_field)
        const FALLBACK_CASHBACK_PERCENT = 0;

        // Fetch the client's card WITH template bonus info
        const { data: card, error: cardError } = await serviceSupabase
            .from('issued_cards')
            .select('uuid, guest_name, balance, card_template_id, card_templates(bonus_percent_field)')
            .eq('uuid', client_id)
            .single();

        if (cardError) {
            console.error('Card fetch error:', cardError);
            return res.status(404).json({ error: 'Client card not found', detail: cardError.message });
        }

        if (!card) {
            console.error('Card not found for client_id:', client_id);
            return res.status(404).json({ error: 'Client card not found' });
        }

        console.log('Card fetched successfully:', { uuid: card.uuid, has_template: !!card.card_templates });

        // Use card-specific bonus_percent_field if exists, else fallback
        // Parse bonus_percent_field as integer (it's stored as string like "0", "5", "10")
        let cashback_percent = FALLBACK_CASHBACK_PERCENT;
        if (card.card_templates?.bonus_percent_field) {
            const parsed = parseInt(card.card_templates.bonus_percent_field, 10);
            if (!isNaN(parsed)) {
                cashback_percent = parsed;
            }
        }

        console.log('Using cashback percent:', cashback_percent);

        let points_change = 0;
        let new_balance = card.balance;

        // 3. Process the transaction based on action
        if (action === 'accrue') {
            // Calculate points with decimal precision
            points_change = smartRound(numAmount * cashback_percent / 100);
            new_balance = smartRound(card.balance + points_change);
        } else if (action === 'redeem') {
            // Redeem: use all available points (up to bill amount)
            // 1 point = 1 currency unit
            const points_to_redeem = smartRound(Math.min(card.balance, numAmount));
            const cash_remainder = smartRound(numAmount - points_to_redeem);

            // Earn cashback on the cash portion
            const earned_points = smartRound(cash_remainder * cashback_percent / 100);

            // Net change: earned - redeemed
            points_change = smartRound(earned_points - points_to_redeem);
            new_balance = smartRound(card.balance + points_change);
        }

        // 4. Update the card balance
        const { error: updateError } = await serviceSupabase
            .from('issued_cards')
            .update({ balance: new_balance })
            .eq('uuid', client_id);

        if (updateError) {
            console.error('Failed to update balance:', updateError);
            return res.status(500).json({ error: 'Failed to update card balance' });
        }

        // 5. Log the transaction
        const { error: logError } = await serviceSupabase
            .from('transactions')
            .insert([{
                user_id: client_id,
                cashier_id: cashier_id,
                amount: numAmount,
                points_change: points_change,
                type: action
            }]);

        if (logError) {
            console.error('Failed to log transaction:', logError);
            // Don't fail the request, but log the error
        }

        // 6. Send PassKit push notification to update the pass
        sendPasskitPush(card.uuid).catch(err => {
            console.error('Failed to send push notification:', err);
        });

        // 7. Return success response
        return res.status(200).json({
            status: 'ok',
            new_balance: new_balance,
            points_change: points_change,
            client_name: card.guest_name,
            action: action
        });

    } catch (err) {
        console.error('Transaction error:', err);
        return res.status(500).json({
            error: 'Internal Server Error',
            detail: String(err.message || err)
        });
    }
};
