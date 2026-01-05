// api/notifications/send.js
// Vercel Serverless Function for sending marketing push notifications

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;

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
        const { title, body, target_audience } = req.body || {};

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
        // 4. PLACEHOLDER: SEND PUSH NOTIFICATIONS
        // =========================================================================
        // TODO: Connect to real Apple APNs and Firebase FCM
        console.log('='.repeat(60));
        console.log('📱 PUSH NOTIFICATION PLACEHOLDER');
        console.log('='.repeat(60));
        console.log(`Target: ${targetValue === 'all' ? 'ALL USERS' : 'TEST GROUP'}`);
        console.log(`Title: ${sanitizedTitle}`);
        console.log(`Body: ${sanitizedBody}`);
        console.log('Sending Push to APNs... (PLACEHOLDER - NOT CONNECTED)');
        console.log('Sending Push to FCM... (PLACEHOLDER - NOT CONNECTED)');
        console.log('='.repeat(60));

        // In the future, this would:
        // 1. Query all device tokens from pass_devices table
        // 2. Filter by target_audience if 'test'
        // 3. Send APNs push via node-apn
        // 4. Send FCM push via firebase-admin

        // =========================================================================
        // 5. RETURN SUCCESS
        // =========================================================================
        return res.status(200).json({
            status: 'ok',
            campaign_id: campaign.id,
            message: 'Рассылка успешно отправлена'
        });

    } catch (err) {
        console.error('Notification send error:', err);
        return res.status(500).json({
            error: 'Internal Server Error',
            detail: String(err.message || err)
        });
    }
};
