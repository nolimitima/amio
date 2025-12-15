// api/transaction/route.js
// Vercel Serverless Function for POS Terminal transactions

const { createClient } = require('@supabase/supabase-js');
const apnProvider = require('../lib/apn');
const apn = require('node-apn');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const PASS_TYPE_IDENTIFIER = process.env.PASS_TYPE_IDENTIFIER;

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

        // 1. Fetch cashback percentage from app_settings
        const { data: settings, error: settingsError } = await serviceSupabase
            .from('app_settings')
            .select('cashback_percent')
            .limit(1)
            .single();

        if (settingsError || !settings) {
            return res.status(500).json({ error: 'Failed to fetch app settings' });
        }

        const globalCashbackPercent = settings.cashback_percent;

        // 2. Fetch the client's card WITH template cashback info
        const { data: card, error: cardError } = await serviceSupabase
            .from('issued_cards')
            .select('uuid, guest_name, balance, card_template_id, card_templates(cashback_percent)')
            .eq('uuid', client_id)
            .single();

        if (cardError || !card) {
            return res.status(404).json({ error: 'Client card not found' });
        }

        // Use card-specific cashback if exists, else global
        const cashback_percent = card.card_templates?.cashback_percent ?? globalCashbackPercent;

        let points_change = 0;
        let new_balance = card.balance;

        // 3. Process the transaction based on action
        if (action === 'accrue') {
            // Calculate points: floor(amount * cashback_percent / 100)
            points_change = Math.floor(numAmount * cashback_percent / 100);
            new_balance = card.balance + points_change;
        } else if (action === 'redeem') {
            // Redeem: use all available points (up to bill amount)
            // 1 point = 1 currency unit
            const points_to_redeem = Math.min(card.balance, numAmount);
            const cash_remainder = numAmount - points_to_redeem;

            // Earn cashback on the cash portion
            const earned_points = Math.floor(cash_remainder * cashback_percent / 100);

            // Net change: earned - redeemed
            points_change = earned_points - points_to_redeem;
            new_balance = card.balance + points_change;
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
