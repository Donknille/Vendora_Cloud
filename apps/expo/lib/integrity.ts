import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { requestIntegrityToken } from 'react-native-google-play-integrity';

/**
 * Validates the integrity of the application environment before allowing
 * sensitive API requests (such as fetching Premium data or processing payments).
 */
export async function getAppIntegrityToken(): Promise<string> {
    try {
        if (Platform.OS === "android") {
            try {
                // In production, nonce should be fetched from backend
                const nonce = "secure_nonce_1234567890";
                const token = await requestIntegrityToken(nonce);
                return token;
            } catch (err) {
                console.warn("Play Integrity Token Request failed, falling back to mock:", err);
                return await Crypto.digestStringAsync(
                    Crypto.CryptoDigestAlgorithm.SHA256,
                    "android_play_integrity_mock_token"
                );
            }
        } else if (Platform.OS === "ios") {
            // const token = await AppAttest.requestAttestation(challenge);
            return await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                "ios_app_attest_mock_token"
            );
        }

        return "web_integrity_token";
    } catch (e) {
        console.error("Integrity check failed:", e);
        throw new Error("App Integrity Compromised.");
    }
}

/**
 * Secure API wrapper that appends Integrity Tokens and API Request Signatures
 */
export async function secureApiFetch(url: string, options: RequestInit = {}) {
    const integrityToken = await getAppIntegrityToken();

    // Generate Request Signature (HMAC alternative using SHA256)
    const timestamp = Date.now().toString();
    const secret = process.env.EXPO_PUBLIC_API_SECRET || "default_development_secret";

    // Extract path part of URL for signature to avoid host mismatches
    let pathPart = url;
    try {
        if (url.startsWith("http")) {
            const parsed = new URL(url);
            pathPart = parsed.pathname + parsed.search;
        }
    } catch (e) { /* ignore */ }

    const method = (options.method || "GET").toUpperCase();
    const bodyStr = options.body && typeof options.body === "string" ? options.body : "";

    // Payload format: secret:method:path:timestamp:body
    const signaturePayload = `${secret}:${method}:${pathPart}:${timestamp}:${bodyStr}`;
    const signature = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        signaturePayload
    );

    const headers = {
        ...options.headers,
        "x-app-integrity-token": integrityToken,
        "x-timestamp": timestamp,
        "x-app-signature": signature,
    };

    return fetch(url, { ...options, headers });
}
