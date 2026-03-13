# Vendora - Business Management App

## Overview
Vendora is a premium, offline-first business management application designed for craft entrepreneurs, market stall owners, and small vendors. Built with Expo React Native using an "Obsidian & Gold" design theme.

## Architecture
- **Frontend**: Expo Router (file-based routing) with React Native
- **Backend**: Express server (port 5000) for landing page and API
- **Storage**: AsyncStorage for local-first data persistence
- **Design**: Obsidian & Gold color palette with Inter font family
- **State**: Local state with useState, data loaded via AsyncStorage utilities

## Key Features
- Full bilingual support (German & English) with automatic device language detection
- Dashboard with revenue/expense/profit analytics and monthly performance charts
- Order management with status tracking and invoice numbering
- Market/event mode with quick sales entry
- Expense tracking with categories and custom date selection
- Company profile settings for invoices
- Data backup/restore (JSON export/import)
- Factory reset option
- Manual language switching in Settings
- Invoice PDF generation with professional German-standard layout
- Custom date fields for orders (orderDate) and expenses (expenseDate)
- Theme switching: Light/Dark/System with persistence

## Project Structure
- `app/(tabs)/` - Main tab screens (Dashboard, Orders, Markets, Expenses, Settings)
- `app/order/` - Order creation and detail screens
- `app/market/` - Market creation and detail screens
- `components/` - Reusable UI components (Card, StatusBadge, EmptyState, DateInput)
- `constants/colors.ts` - Obsidian & Gold theme colors
- `lib/storage.ts` - AsyncStorage data layer (Order, Expense, Market, MarketSale, CompanyProfile interfaces)
- `lib/useTheme.ts` - Theme hook
- `lib/formatCurrency.ts` - Currency formatting utilities (Euro, comma decimal)
- `lib/i18n.ts` - Translation strings (EN/DE) and device language detection
- `lib/LanguageContext.tsx` - Language context provider with persistence
- `lib/ThemeContext.tsx` - Theme context provider (Light/Dark/System)
- `lib/invoiceTemplate.ts` - Professional HTML/CSS invoice template
- `lib/confirmAction.ts` - Cross-platform confirmation dialogs
- `components/DateInput.tsx` - Custom calendar date picker component

## Recent Changes
- Custom date fields: orderDate (orders) and expenseDate (expenses) with DateInput calendar picker
- Dashboard year filtering uses orderDate/expenseDate with createdAt/date fallback
- All date displays use German locale format (de-DE)
- Invoice PDF uses orderDate for invoice date
- Cross-platform confirmAction helper for delete operations
- Theme switching: Light/Dark/System with persistence via ThemeContext
- Dashboard year filtering with horizontal scrollable chips

## Data Model Notes
- Order: has `orderDate` (custom) and `createdAt` (auto). Display/filter uses `orderDate || createdAt`
- Expense: has `expenseDate` (custom) and `date` (auto). Display/filter uses `expenseDate || date`
- MarketSale: uses `createdAt` (auto)
- Market: uses `date` field

## User Preferences
- Premium dark theme with gold accents
- Offline-first architecture
- Privacy by default (no tracking/analytics)
- German locale formatting for dates and currency
