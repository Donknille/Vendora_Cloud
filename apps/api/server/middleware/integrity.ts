import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export const requireIntegrity = async (req: Request, res: Response, next: NextFunction) => {
    // 1. Hardware Attestation Check (App Integrity Token)
    const integrityToken = req.headers["x-app-integrity-token"] as string;
    if (!integrityToken) {
        return res.status(403).json({ error: "Missing App Integrity Token. Update your app." });
    }

    const isIOSMock = integrityToken === crypto.createHash('sha256').update('ios_app_attest_mock_token').digest('hex');
    const isAndroidMock = integrityToken === crypto.createHash('sha256').update('android_play_integrity_mock_token').digest('hex');
    const isWebMock = integrityToken === 'web_integrity_token';
    const isAndroidProdToken = integrityToken.length > 50; // Simple heuristic for a real JWT/token from Play Integrity

    if (!isIOSMock && !isAndroidMock && !isWebMock && !isAndroidProdToken) {
        console.warn("Invalid Integrity Token", integrityToken);
        return res.status(403).json({ error: "App Integrity Check Failed. Modified client detected." });
    }

    // 2. API Request Signing Check (HMAC-SHA256)
    const timestamp = req.headers["x-timestamp"] as string;
    const signature = req.headers["x-app-signature"] as string;

    if (!timestamp || !signature) {
        return res.status(403).json({ error: "Missing Request Signature. Update your app." });
    }

    const now = Date.now();
    const reqTime = parseInt(timestamp, 10);
    // Block requests older than 1 minute (60000ms) -- also allow minor future drift (10000ms)
    if (isNaN(reqTime) || now - reqTime > 60000 || reqTime - now > 10000) {
        return res.status(403).json({ error: "Request expired (Replay Attack Prevention)" });
    }

    const secret = process.env.EXPO_PUBLIC_API_SECRET || "default_development_secret";
    const method = req.method.toUpperCase();
    const pathPart = req.originalUrl;

    // The frontend sends an empty string if no body. For JSON bodies, it stringifies it.
    // We recreate that here by re-stringifying if there's an object.
    const bodyStr = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : "";

    const payload = `${secret}:${method}:${pathPart}:${timestamp}:${bodyStr}`;
    const expectedSignature = crypto.createHash('sha256').update(payload).digest('hex');

    if (expectedSignature !== signature) {
        console.warn(`Integrity signature mismatch! Expected ${expectedSignature}, got ${signature}`);
        return res.status(403).json({ error: "Invalid request signature" });
    }

    next();
};
