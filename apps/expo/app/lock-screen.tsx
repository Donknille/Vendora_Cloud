import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator, Platform } from "react-native";
import { useAuth } from "../lib/auth";
import { useLanguage } from "../lib/LanguageContext";
import { useTheme } from "../lib/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Checkbox from "expo-checkbox";

if (Platform.OS !== "web") {
    WebBrowser.maybeCompleteAuthSession();
}

type AuthMode = "login" | "register" | "forgotPassword";

export default function LockScreen() {
    const { isLoading: isAuthLoading } = useAuth();
    const theme = useTheme();
    const { t } = useLanguage();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<AuthMode>("login");
    const [privacyAccepted, setPrivacyAccepted] = useState(false);

    if (isAuthLoading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.gold} />
            </View>
        );
    }

    const translateErrorMessage = (errorMessage: string) => {
        if (errorMessage.includes("Invalid login credentials")) return "Falsche E-Mail oder Passwort.";
        if (errorMessage.includes("Password should be")) return "Das Passwort muss mindestens 6 Zeichen lang sein.";
        if (errorMessage.includes("already registered")) return "Diese E-Mail-Adresse ist bereits registriert.";
        return errorMessage;
    };

    const handleAuthAction = async () => {
        if (!email) {
            Alert.alert("Fehler", "Bitte gib deine E-Mail-Adresse ein.");
            return;
        }

        if (mode !== "forgotPassword" && !password) {
            Alert.alert("Fehler", "Bitte gib ein Passwort ein.");
            return;
        }

        if (mode !== "forgotPassword" && !privacyAccepted) {
            Alert.alert("Hinweis", "Bitte akzeptiere die Datenschutzerklärung, um fortzufahren.");
            return;
        }

        setIsLoading(true);
        try {
            if (mode === "login") {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else if (mode === "register") {
                const { error, data } = await supabase.auth.signUp({ email, password });
                if (error) throw error;

                if (data.user?.identities?.length === 0) {
                    Alert.alert("Fehler", "Diese E-Mail-Adresse ist bereits registriert.");
                    return;
                }

                Alert.alert("Erfolg", "Account erfolgreich erstellt. Du bist nun eingeloggt.");
            } else if (mode === "forgotPassword") {
                const { error } = await supabase.auth.resetPasswordForEmail(email);
                if (error) throw error;
                Alert.alert("E-Mail gesendet", "Bitte überprüfe dein Postfach, um das Passwort zurückzusetzen.");
                setMode("login");
            }
        } catch (error: any) {
            Alert.alert("Fehler", translateErrorMessage(error.message) || "Ein Authentifizierungsfehler ist aufgetreten.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        if (!privacyAccepted) {
            Alert.alert("Hinweis", "Bitte akzeptiere die Datenschutzerklärung, um fortzufahren.");
            return;
        }
        setIsLoading(true);
        try {
            const redirectUrl = Linking.createURL('/auth/callback');
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                },
            });

            if (error) throw error;

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
                if (result.type === 'success' && result.url) {
                    // Extract tokens from the URL (Supabase appends them as hash fragments in Implicit flow)
                    const parsedUrl = Linking.parse(result.url.replace('#', '?'));
                    const params = parsedUrl.queryParams || {};

                    if (params.access_token && params.refresh_token) {
                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token: params.access_token as string,
                            refresh_token: params.refresh_token as string,
                        });

                        if (sessionError) {
                            throw sessionError;
                        }
                    } else if (params.error_description) {
                        throw new Error(params.error_description as string);
                    }
                }
            }
        } catch (error: any) {
            Alert.alert("Fehler", error.message || "Google Login fehlgeschlagen.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.content}>
                <Ionicons name="cloud-outline" size={80} color={theme.gold} />
                <Text style={[styles.title, { color: theme.text }]}>Vendora Cloud</Text>

                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    {mode === "login" && "Melde dich an, um deine Daten zu synchronisieren"}
                    {mode === "register" && "Erstelle einen neuen Account"}
                    {mode === "forgotPassword" && "Passwort zurücksetzen"}
                </Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                        placeholder="E-Mail"
                        placeholderTextColor={theme.textSecondary}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />
                    {mode !== "forgotPassword" && (
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                            placeholder="Passwort"
                            placeholderTextColor={theme.textSecondary}
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    )}
                </View>

                {mode === "login" && (
                    <TouchableOpacity onPress={() => setMode("forgotPassword")} style={styles.forgotPasswordButton}>
                        <Text style={[styles.forgotPasswordText, { color: theme.textSecondary }]}>Passwort vergessen?</Text>
                    </TouchableOpacity>
                )}

                {mode !== "forgotPassword" && (
                    <View style={styles.privacyContainer}>
                        <Checkbox
                            value={privacyAccepted}
                            onValueChange={setPrivacyAccepted}
                            color={privacyAccepted ? theme.gold : undefined}
                            style={styles.checkbox}
                        />
                        <View style={styles.privacyTextContainer}>
                            <Text style={[styles.privacyLabel, { color: theme.textSecondary }]}>
                                Ich akzeptiere die{" "}
                            </Text>
                            <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync('https://vendora.app/privacy')}>
                                <Text style={[styles.privacyLabel, { color: theme.gold, textDecorationLine: "underline" }]}>
                                    Datenschutzerklärung
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.gold, opacity: isLoading ? 0.7 : 1, marginBottom: 16 }]}
                    onPress={handleAuthAction}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={theme.background} />
                    ) : (
                        <Text style={[styles.buttonText, { color: theme.background }]}>
                            {mode === "login" && "Anmelden"}
                            {mode === "register" && "Registrieren"}
                            {mode === "forgotPassword" && "Reset-Link senden"}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.googleButton, { borderColor: theme.border, backgroundColor: theme.card, opacity: isLoading ? 0.7 : 1 }]}
                    onPress={handleGoogleAuth}
                    disabled={isLoading}
                >
                    <Ionicons name="logo-google" size={24} color={theme.text} style={{ marginRight: 12 }} />
                    <Text style={[styles.googleButtonText, { color: theme.text }]}>
                        Mit Google anmelden
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setMode(mode === "login" ? "register" : "login")}
                    style={styles.switchModeButton}
                >
                    <Text style={[styles.switchModeText, { color: theme.gold }]}>
                        {mode === "login"
                            ? "Noch keinen Account? Registrieren"
                            : "Zurück zur Anmeldung"}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", alignItems: "center" },
    content: { alignItems: "center", padding: 24, width: "100%", maxWidth: 400 },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 24, marginBottom: 8 },
    subtitle: { fontSize: 16, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 32 },
    inputContainer: { width: "100%", marginBottom: 16 },
    input: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 16, fontFamily: "Inter_400Regular" },
    button: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 12, width: "100%" },
    googleButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 12, width: "100%", borderWidth: 1, marginBottom: 16 },
    googleButtonText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
    switchModeButton: { marginTop: 20 },
    switchModeText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
    buttonText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
    forgotPasswordButton: { alignSelf: "flex-end", marginBottom: 24 },
    forgotPasswordText: { fontSize: 14, fontFamily: "Inter_400Regular" },
    privacyContainer: { flexDirection: "row", alignItems: "center", marginBottom: 24, paddingHorizontal: 4 },
    checkbox: { marginRight: 12, borderRadius: 4, width: 20, height: 20 },
    privacyTextContainer: { flexDirection: "row", flexWrap: "wrap", flex: 1 },
    privacyLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
