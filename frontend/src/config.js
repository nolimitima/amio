/**
 * Application Configuration
 * Centralized configuration constants for easy management
 */

// WhatsApp contact for activation requests
// Format: Country code + number without + or spaces
export const OWNER_PHONE_NUMBER = '77767802565';

// Subscription status values
export const SUBSCRIPTION_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    TRIAL: 'trial',
    EXPIRED: 'expired',
    BANNED: 'banned',
};

// Pricing configuration (in KZT)
export const PRICING = {
    TRIAL_DAYS: 14,
    MONTHLY_PRICE: '9 990 ₸',
};
