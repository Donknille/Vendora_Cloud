# Mobile Beta Gate

This checklist is the release gate for Vendora preview builds before TestFlight and Google Play Internal Testing.

## 1. Prerequisites

- `npm run release:gate` passes in `apps/expo`
- Migrations are applied on the target database
- Production-grade mobile/public values are present for `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_API_SECRET`, Supabase anon key, and the public RevenueCat SDK keys
- Production-grade server-only values are present in the API environment for `SUPABASE_SERVICE_ROLE_KEY`, `REVENUECAT_SECRET_KEY`, `DATABASE_URL`, and `DIRECT_URL`
- No server-only secret is exposed through Expo or an `EXPO_PUBLIC_*` variable
- A test Supabase account exists for login, purchase, restore, and delete-account checks
- App Store and Play billing products are available in sandbox/internal test mode

## 2. Preview Build Commands

```bash
cd apps/expo
npm run release:gate
npm run build:preview:ios
npm run build:preview:android
```

## 3. Device Matrix

Fill this table for every beta round.

| Device | OS | Build | Tester | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| iPhone 15 / physical device | iOS 18.x | preview |  |  |  |
| Pixel 8 / physical device | Android 15 | preview |  |  |  |
| Samsung A54 / physical device | Android 14 | preview |  |  |  |

## 4. Smoke Tests

Mark every row `PASS`, `FAIL`, or `N/A`.

| ID | Flow | Expected Result | Result | Notes |
| --- | --- | --- | --- | --- |
| S1 | Cold launch | App opens without crash and reaches auth or dashboard |  |  |
| S2 | Login | Google/Supabase login succeeds and `/api/users/sync` completes |  |  |
| S3 | Subscription state | Trial or Pro state loads correctly in Settings and Paywall |  |  |
| S4 | Create order | New order with items saves and appears in list/details |  |  |
| S5 | Edit order | Status, notes, and item updates persist after app relaunch |  |  |
| S6 | Invoice export | Invoice PDF can be generated and shared |  |  |
| S7 | Create market | Market saves with fees, quick items, and details screen data |  |  |
| S8 | Market sales | Quick sale and manual sale update totals correctly |  |  |
| S9 | Expenses | Expense create/edit/delete works and dashboard totals update |  |  |
| S10 | Dashboard | Revenue, expenses, and net totals match cloud data |  |  |
| S11 | Purchase Pro | Native purchase unlocks Pro and server status refreshes |  |  |
| S12 | Restore purchases | Restore reactivates Pro on a fresh session/device |  |  |
| S13 | Trial expiry gate | Expired trial blocks new creates but still allows reads |  |  |
| S14 | Account delete | Delete removes account, logs out, and prevents stale data on relaunch |  |  |
| S15 | Offline handling | App shows recoverable errors when network is unavailable |  |  |

## 5. Go / No-Go

`GO` only if all points below are true:

- All `S1` to `S14` are `PASS`
- No crash or infinite loading state in any tested core flow
- Purchase, restore, and account delete work on real devices
- No request falls back to localhost or the development API secret
- Preview builds install successfully on at least one iPhone and one Android device

`NO-GO` if any point below is true:

- A create, edit, delete, purchase, restore, or delete-account flow fails
- Login or subscription status is inconsistent between app and backend
- Any 401, 403, or 500 appears in a normal user flow without a clear recovery path
- A blocking visual bug prevents navigation or primary actions

## 6. Sign-off

| Role | Name | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| Product / QA |  |  |  |  |
| Engineering |  |  |  |  |
