const fs = require('fs');

const rootPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const serverDeps = [
    "express", "pg", "drizzle-orm", "drizzle-zod", "zod", "http-proxy-middleware", "ws", "tsx", "@stardazed/streams-text-encoding"
];
const serverDevDeps = [
    "drizzle-kit", "@types/express", "@types/pg", "cross-env", "typescript", "esbuild", "@types/node"
];

const sharedDeps = [
    "drizzle-orm", "drizzle-zod", "zod"
];

const expoDeps = Object.keys(rootPackage.dependencies).filter(dep => !serverDeps.includes(dep) || sharedDeps.includes(dep));
const expoDevDeps = Object.keys(rootPackage.devDependencies).filter(dep => !serverDevDeps.includes(dep));

// Root
const newRoot = {
    "name": "vendora-monorepo",
    "private": true,
    "workspaces": [
        "apps/*",
        "packages/*"
    ]
};

// Api
const apiPackage = {
    "name": "@vendora/api",
    "version": "1.0.0",
    "scripts": {
        "dev": "cross-env NODE_ENV=development tsx server/index.ts",
        "build": "esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
        "start": "cross-env NODE_ENV=production node dist/index.js",
        "db:push": "drizzle-kit push"
    },
    "dependencies": {
        "@vendora/shared": "*",
        ...serverDeps.reduce((acc, dep) => ({ ...acc, [dep]: rootPackage.dependencies[dep] || "latest" }), {})
    },
    "devDependencies": {
        ...serverDevDeps.reduce((acc, dep) => ({ ...acc, [dep]: rootPackage.devDependencies[dep] || rootPackage.dependencies[dep] || "latest" }), {})
    }
};

// Shared
const sharedPackage = {
    "name": "@vendora/shared",
    "version": "1.0.0",
    "main": "schema.ts",
    "dependencies": {
        ...sharedDeps.reduce((acc, dep) => ({ ...acc, [dep]: rootPackage.dependencies[dep] || "latest" }), {})
    }
};

// Expo
const expoPackage = {
    "name": "@vendora/expo",
    "version": "1.1.1",
    "main": "expo-router/entry",
    "scripts": {
        "start": "expo start",
        "android": "expo run:android",
        "ios": "expo run:ios",
        "web": "expo start --web"
    },
    "dependencies": {
        "@vendora/shared": "*",
        ...expoDeps.reduce((acc, dep) => ({ ...acc, [dep]: rootPackage.dependencies[dep] || "latest" }), {})
    },
    "devDependencies": {
        ...expoDevDeps.reduce((acc, dep) => ({ ...acc, [dep]: rootPackage.devDependencies[dep] || "latest" }), {})
    }
};

fs.writeFileSync('package.json', JSON.stringify(newRoot, null, 2));
fs.writeFileSync('apps/api/package.json', JSON.stringify(apiPackage, null, 2));
fs.writeFileSync('packages/shared/package.json', JSON.stringify(sharedPackage, null, 2));
fs.writeFileSync('apps/expo/package.json', JSON.stringify(expoPackage, null, 2));

console.log('Successfully structured monorepo package.json files!');
