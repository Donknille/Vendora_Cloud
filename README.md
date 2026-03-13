# Vendora Cloud

Vendora Cloud is the standalone monorepo for the cloud-backed Vendora app.

It contains:
- `apps/expo`: the Expo / React Native client
- `apps/api`: the Node / Express API
- `packages/shared`: shared schema and types
- `supabase`: local Supabase config and migrations

## Requirements

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

## Environment setup

Copy the example files and fill in your own values:

```bash
cp .env.example .env
cp .env.development.example .env.development
cp .env.production.example .env.production
```

Required values include:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_APPLE_KEY`
- `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY`
- `DATABASE_URL`
- `DIRECT_URL`

Do not commit real secrets. The repo ignores live `.env` files by default.

## Run the Expo app

```bash
cd apps/expo
npm start
```

Useful commands:

```bash
npm run android
npm run ios
npm run web
```

## Run the API

```bash
cd apps/api
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## Notes

- Build artifacts such as `.aab`, `.apk`, and `.ipa` files are intentionally not tracked in Git.
- Store builds should be published through EAS or attached as GitHub Releases instead of being committed to the repository.
