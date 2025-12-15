# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a loyalty card management system with PassKit integration. The application consists of:

- **Frontend**: React/Vite SPA with Tailwind CSS, hosted on Vercel
- **Backend**: Serverless functions for pass generation and POS terminal integration  
- **Database**: Supabase for user data, transactions, and pass tracking
- **PassKit**: Apple Wallet pass generation and push notifications

## Development Commands

### Frontend Development
```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Root Level
The root package.json has minimal scripts for Vercel deployment.

## Architecture

### Core Components

**Frontend Structure** (`/frontend/src/`):
- **Pages**: Login/Signup, Dashboard, Scanner, Settings, CardPreview
- **Context**: AuthContext for Supabase authentication
- **Components**: BrandLayout, ScanLogsList for reusable UI

**API Structure** (`/api/`):
- **PassKit endpoints** (`/api/passkit/v1/`): Standard PassKit web service
- **Pass generation** (`/api/passes/`): Custom pass creation and management
- **Transaction processing** (`/api/transaction.js`): POS terminal integration
- **Scanner** (`/api/scanner/scan.js`): QR code scanning endpoint

**Backend Services** (`/lib/`):
- **APN provider** (`/lib/apn.js`): Apple Push Notification configuration

### Database Schema

Key Supabase tables (referenced in transaction.js:20-24):
- `pass_devices`: Device registration for push notifications
- Transaction logging and user management tables

### Environment Configuration

**Frontend** (`.env.local`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Backend** (Vercel environment variables):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE`
- `PASS_TYPE_IDENTIFIER`
- PassKit certificates and APN configuration

### Key Integrations

**Supabase Client**: Configured in `frontend/src/supabaseClient.js:10-16` with auth persistence and auto-refresh

**PassKit Push Notifications**: Implemented in `api/transaction.js:13-48` for real-time pass updates

**QR Code Scanning**: Uses html5-qrcode library for camera-based scanning

## Deployment

- **Platform**: Vercel with SPA routing configured in `vercel.json`
- **Build**: Frontend builds to `/frontend/dist/`
- **API**: Serverless functions deploy from `/api/` directory

## Development Guidelines

Key principles from Cursor rules:
- Use functional/declarative patterns over classes  
- Implement proper TypeScript with descriptive variable names
- Follow Tailwind CSS for all styling
- Use early returns for error handling
- Implement proper accessibility features
- Prioritize React Server Components when applicable

## Testing

No test framework currently configured. Tests should be added using Jest and React Testing Library as per the development guidelines.