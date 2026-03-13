const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const entries = new Map();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    entries.set(key, value);
  }

  return entries;
}

function pushIssue(target, message) {
  target.push(`- ${message}`);
}

const expoDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(expoDir, "..", "..");

const appJsonPath = path.join(expoDir, "app.json");
const easJsonPath = path.join(expoDir, "eas.json");
const envProductionExamplePath = path.join(repoRoot, ".env.production.example");
const betaGateDocPath = path.join(expoDir, "release", "MOBILE_BETA_GATE.md");
const buildInfoPath = path.join(repoRoot, "build_info.json");

const errors = [];
const warnings = [];

const appConfig = readJson(appJsonPath).expo;
const easConfig = readJson(easJsonPath);
const envProduction = readEnvFile(envProductionExamplePath);

if (!appConfig.name) {
  pushIssue(errors, "`expo.name` is missing in app.json.");
}

if (!appConfig.version) {
  pushIssue(errors, "`expo.version` is missing in app.json.");
}

if (!appConfig.ios?.bundleIdentifier) {
  pushIssue(errors, "`expo.ios.bundleIdentifier` is missing.");
}

if (!appConfig.ios?.buildNumber) {
  pushIssue(errors, "`expo.ios.buildNumber` is missing.");
}

if (!appConfig.android?.package) {
  pushIssue(errors, "`expo.android.package` is missing.");
}

if (!Number.isInteger(appConfig.android?.versionCode)) {
  pushIssue(errors, "`expo.android.versionCode` must be an integer.");
}

if (!appConfig.extra?.eas?.projectId) {
  pushIssue(errors, "`expo.extra.eas.projectId` is missing.");
}

if (easConfig.build?.preview?.distribution !== "internal") {
  pushIssue(errors, "`preview` build profile must use `distribution: internal`.");
}

if (easConfig.build?.preview?.android?.buildType !== "apk") {
  pushIssue(errors, "`preview.android.buildType` should be `apk` for device installs.");
}

if (!easConfig.build?.production) {
  pushIssue(errors, "`production` build profile is missing in eas.json.");
}

if (!easConfig.submit?.production) {
  pushIssue(errors, "`submit.production` is missing in eas.json.");
}

const requiredPublicProductionKeys = [
  "EXPO_PUBLIC_DOMAIN",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_API_SECRET",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_REVENUECAT_APPLE_KEY",
  "EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY",
  "EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID",
];

const requiredServerProductionKeys = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REVENUECAT_SECRET_KEY",
  "REVENUECAT_ENTITLEMENT_ID",
  "DATABASE_URL",
  "DIRECT_URL",
];

for (const key of requiredPublicProductionKeys) {
  if (!envProduction.has(key)) {
    pushIssue(
      errors,
      `Required mobile/public key \`${key}\` is missing from .env.production.example.`,
    );
  }
}

for (const key of requiredServerProductionKeys) {
  if (!envProduction.has(key)) {
    pushIssue(
      errors,
      `Required server-only key \`${key}\` is missing from .env.production.example.`,
    );
  }
}

const serverOnlyKeysWithPublicPrefix = requiredServerProductionKeys.filter((key) =>
  key.startsWith("EXPO_PUBLIC_"),
);

if (serverOnlyKeysWithPublicPrefix.length > 0) {
  pushIssue(
    errors,
    `Server-only keys must never use the EXPO_PUBLIC_ prefix: ${serverOnlyKeysWithPublicPrefix.join(", ")}`,
  );
}

const productionApiUrl = envProduction.get("EXPO_PUBLIC_API_URL") || "";
if (productionApiUrl.includes("localhost")) {
  pushIssue(errors, "`EXPO_PUBLIC_API_URL` must not point to localhost in production.");
}

const productionDomain = envProduction.get("EXPO_PUBLIC_DOMAIN") || "";
if (productionDomain.includes("localhost")) {
  pushIssue(errors, "`EXPO_PUBLIC_DOMAIN` must not point to localhost in production.");
}

const productionApiSecret = envProduction.get("EXPO_PUBLIC_API_SECRET") || "";
if (productionApiSecret === "default_development_secret") {
  pushIssue(errors, "`EXPO_PUBLIC_API_SECRET` must not use the development fallback.");
}

if (!fs.existsSync(betaGateDocPath)) {
  pushIssue(errors, "Release smoke matrix is missing at apps/expo/release/MOBILE_BETA_GATE.md.");
}

if (fs.existsSync(buildInfoPath)) {
  pushIssue(
    warnings,
    "`build_info.json` exists locally. Keep it out of Git and refresh it per build run.",
  );
}

console.log("Vendora mobile release gate");
console.log(`App version: ${appConfig.version}`);
console.log(`iOS buildNumber: ${appConfig.ios?.buildNumber ?? "missing"}`);
console.log(`Android versionCode: ${appConfig.android?.versionCode ?? "missing"}`);
console.log(
  `Validated public env keys: ${requiredPublicProductionKeys.length}, server-only env keys: ${requiredServerProductionKeys.length}`,
);

if (warnings.length > 0) {
  console.log("\nWarnings");
  for (const warning of warnings) {
    console.log(warning);
  }
}

if (errors.length > 0) {
  console.error("\nRelease gate failed");
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log("\nRelease gate passed");
console.log("- Build preview binaries on iOS and Android");
console.log("- Execute the smoke matrix in apps/expo/release/MOBILE_BETA_GATE.md");
console.log("- Record a Go/No-Go decision before TestFlight or Play Internal Testing");
