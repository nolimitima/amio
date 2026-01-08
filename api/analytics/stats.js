// api/analytics/stats.js
// Vercel Serverless Function for Analytics Dashboard

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE;

module.exports = async (req, res) => {
    // Only allow GET requests
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
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

        // Create Supabase client to verify the user
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { persistSession: false }
        });

        // Verify the session and get user
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
        }

        const userId = user.id;

        // 1. Get all card template IDs for this business
        const { data: templates, error: templatesErr } = await supabase
            .from('card_templates')
            .select('id')
            .eq('user_id', userId);

        if (templatesErr) {
            console.error('Error fetching templates:', templatesErr);
            return res.status(500).json({ error: 'Failed to fetch templates' });
        }

        const templateIds = templates?.map(t => t.id) || [];

        // If no templates, return zeros
        if (templateIds.length === 0) {
            return res.status(200).json({
                totalUsers: 0,
                totalScans: 0,
                pointsLiability: 0,
                totalRedeemed: 0,
                recentActivity: []
            });
        }

        // 2. Count total users (issued_cards) for this business
        const { count: totalUsers, error: usersErr } = await supabase
            .from('issued_cards')
            .select('*', { count: 'exact', head: true })
            .in('card_template_id', templateIds);

        if (usersErr) {
            console.error('Error counting users:', usersErr);
        }

        // 3. Get all card UUIDs for this business (for transactions query)
        const { data: cards, error: cardsErr } = await supabase
            .from('issued_cards')
            .select('uuid, balance')
            .in('card_template_id', templateIds);

        if (cardsErr) {
            console.error('Error fetching cards:', cardsErr);
        }

        const cardUuids = cards?.map(c => c.uuid) || [];
        const pointsLiability = cards?.reduce((sum, c) => sum + (Number(c.balance) || 0), 0) || 0;

        // 4. Count total transactions (scans) for this business
        let totalScans = 0;
        let totalRedeemed = 0;

        if (cardUuids.length > 0) {
            // Count all transactions
            const { count: scansCount, error: scansErr } = await supabase
                .from('transactions')
                .select('*', { count: 'exact', head: true })
                .in('user_id', cardUuids);

            if (scansErr) {
                console.error('Error counting scans:', scansErr);
            }
            totalScans = scansCount || 0;

            // Sum redeemed points (negative points_change from redeem actions)
            const { data: redeemData, error: redeemErr } = await supabase
                .from('transactions')
                .select('points_change')
                .in('user_id', cardUuids)
                .eq('type', 'redeem');

            if (redeemErr) {
                console.error('Error fetching redeem data:', redeemErr);
            }

            // Sum up the absolute value of negative points changes (points redeemed)
            totalRedeemed = redeemData?.reduce((sum, t) => {
                const change = Number(t.points_change) || 0;
                // Redeem actions have negative points_change, so we take absolute value
                return sum + Math.abs(Math.min(0, change));
            }, 0) || 0;
        }

        // 5. Get recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        let recentActivity = [];

        if (cardUuids.length > 0) {
            const { data: activityData, error: activityErr } = await supabase
                .from('transactions')
                .select('created_at')
                .in('user_id', cardUuids)
                .gte('created_at', sevenDaysAgo.toISOString())
                .order('created_at', { ascending: true });

            if (activityErr) {
                console.error('Error fetching activity:', activityErr);
            }

            // Group by date
            const activityByDate = {};
            const today = new Date();

            // Initialize all 7 days with 0
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                activityByDate[dateStr] = 0;
            }

            // Count transactions per day
            (activityData || []).forEach(t => {
                const dateStr = new Date(t.created_at).toISOString().split('T')[0];
                if (activityByDate.hasOwnProperty(dateStr)) {
                    activityByDate[dateStr]++;
                }
            });

            // Convert to array
            recentActivity = Object.entries(activityByDate).map(([date, count]) => ({
                date,
                count
            }));
        }

        return res.status(200).json({
            totalUsers: totalUsers || 0,
            totalScans,
            pointsLiability: Math.round(pointsLiability * 100) / 100, // Round to 2 decimals
            totalRedeemed: Math.round(totalRedeemed * 100) / 100,
            recentActivity
        });

    } catch (err) {
        console.error('Analytics error:', err);
        return res.status(500).json({
            error: 'Internal Server Error',
            detail: String(err.message || err)
        });
    }
};
