import Constants, { ExecutionEnvironment } from "expo-constants";
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSubscription } from "../lib/subscription";
import { useTheme } from "../lib/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export default function PaywallScreen() {
    const { currentOffering, purchasePackage, restorePurchases, isSubscribed, bypassSubscription, isInTrial, daysUntilTrialEnds } = useSubscription();
    const theme = useTheme();
    const router = useRouter();
    const [isPurchasing, setIsPurchasing] = useState(false);

    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

    if (isSubscribed) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.center}>
                    <Ionicons name="checkmark-circle-outline" size={80} color={theme.gold} />
                    <Text style={[styles.title, { color: theme.text, marginTop: 24 }]}>You are a Pro!</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                        Thank you for your subscription.
                    </Text>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.gold, marginTop: 24 }]}
                        onPress={() => router.replace("/")}
                    >
                        <Text style={[styles.buttonText, { color: theme.background }]}>Go to Dashboard</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const handlePurchase = async (pkg: any) => {
        setIsPurchasing(true);
        const success = await purchasePackage(pkg);
        setIsPurchasing(false);
        if (success) {
            Alert.alert("Success", "Welcome to Vendora Pro!");
        }
    };

    const handleRestore = async () => {
        const success = await restorePurchases();
        if (success) {
            Alert.alert("Restored", "Your purchases have been restored.");
        } else {
            Alert.alert("Notice", "No active subscriptions found to restore.");
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <LinearGradient
                colors={[theme.background, theme.gold + "10", theme.background]}
                style={StyleSheet.absoluteFill}
            />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInDown.duration(600).delay(100)}>
                    <View style={styles.iconContainer}>
                        <LinearGradient
                            colors={[theme.gold, "#FFD700"]}
                            style={styles.iconGradient}
                        >
                            <Ionicons name="star" size={50} color={theme.background} />
                        </LinearGradient>
                    </View>
                    <Text style={[styles.title, { color: theme.text, textAlign: "center", marginTop: 20 }]}>
                        Unlock Vendora Pro
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary, textAlign: "center", marginBottom: 12 }]}>
                        Get full cloud sync, unlimited markets, and advanced reports.
                    </Text>

                    {/* Trial Status Badge */}
                    <View style={styles.trialBadgeContainer}>
                        {isInTrial && daysUntilTrialEnds > 0 ? (
                            <View style={[styles.trialBadge, { backgroundColor: theme.success + "20", borderColor: theme.success }]}>
                                <Ionicons name="time-outline" size={16} color={theme.success} />
                                <Text style={[styles.trialBadgeText, { color: theme.success }]}>
                                    {daysUntilTrialEnds} Days Free Trial Active
                                </Text>
                            </View>
                        ) : !isSubscribed ? (
                            <View style={[styles.trialBadge, { backgroundColor: theme.error + "20", borderColor: theme.error }]}>
                                <Ionicons name="warning-outline" size={16} color={theme.error} />
                                <Text style={[styles.trialBadgeText, { color: theme.error }]}>
                                    Trial Expired
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.features}>
                    <FeatureItem theme={theme} text="Unlimited Orders & Invoices" />
                    <FeatureItem theme={theme} text="Real-time Cloud Synchronization" />
                    <FeatureItem theme={theme} text="Export Financial PDF Reports" />
                    <FeatureItem theme={theme} text="Priority Support" />
                </Animated.View>

                <Animated.View entering={FadeInUp.duration(600).delay(300)}>
                    {currentOffering?.availablePackages.map((pkg, index) => {
                        const isPrimary = index === 0; // Highlight the first package (usually Monthly/Annual)
                        return (
                            <TouchableOpacity
                                key={pkg.identifier}
                                onPress={() => handlePurchase(pkg)}
                                disabled={isPurchasing}
                                style={{ marginTop: 8 }}
                            >
                                <LinearGradient
                                    colors={isPrimary ? [theme.card, theme.gold + "15"] : [theme.card, theme.card]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={[
                                        styles.packageCard,
                                        { borderColor: isPrimary ? theme.gold : theme.border }
                                    ]}
                                >
                                    <View>
                                        <Text style={[styles.packageTitle, { color: theme.text }]}>
                                            {pkg.product.title}
                                        </Text>
                                        <Text style={[styles.packageDesc, { color: theme.textSecondary }]}>
                                            {pkg.product.description}
                                        </Text>
                                    </View>
                                    <View style={styles.priceContainer}>
                                        <Text style={[styles.packagePrice, { color: isPrimary ? theme.gold : theme.text }]}>
                                            {pkg.product.priceString}
                                        </Text>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        );
                    })}

                    <Text style={[styles.disclaimer, { color: theme.textSecondary }]}>
                        Auto-renewable. Cancel anytime in your store settings.
                    </Text>
                </Animated.View>

                {isPurchasing && <ActivityIndicator style={{ marginTop: 20 }} size="large" color={theme.gold} />}

                <View style={{ flex: 1 }} />

                <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
                    <Text style={[styles.restoreText, { color: theme.textSecondary }]}>Restore Purchases</Text>
                </TouchableOpacity>

                {isExpoGo && (
                    <TouchableOpacity
                        onPress={bypassSubscription}
                        style={[styles.restoreBtn, { marginTop: 10, opacity: 0.5 }]}
                    >
                        <Text style={[styles.restoreText, { color: theme.error, fontSize: 12 }]}>
                            [Dev Mode] Bypass Paywall
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function FeatureItem({ theme, text }: { theme: any; text: string }) {
    return (
        <View style={styles.featureItem}>
            <Ionicons name="checkmark" size={20} color={theme.gold} />
            <Text style={[styles.featureText, { color: theme.text }]}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 24, flexGrow: 1, paddingBottom: 40 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    iconContainer: { alignSelf: "center", marginTop: 20 },
    iconGradient: { width: 90, height: 90, borderRadius: 45, justifyContent: "center", alignItems: "center", shadowColor: "#FFD700", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
    title: { fontSize: 32, fontFamily: "Inter_700Bold" },
    subtitle: { fontSize: 16, fontFamily: "Inter_400Regular", marginTop: 8, lineHeight: 24 },
    trialBadgeContainer: { alignItems: "center", marginBottom: 32 },
    trialBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6, borderWidth: 1 },
    trialBadgeText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    features: { marginBottom: 32, gap: 16 },
    featureItem: { flexDirection: "row", alignItems: "center" },
    featureText: { fontSize: 16, fontFamily: "Inter_500Medium", marginLeft: 16 },
    packageCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 2, borderRadius: 20, padding: 20, marginBottom: 12 },
    packageTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
    packageDesc: { fontSize: 14, fontFamily: "Inter_400Regular", maxWidth: 200, lineHeight: 20 },
    priceContainer: { alignItems: "flex-end" },
    packagePrice: { fontSize: 22, fontFamily: "Inter_700Bold" },
    disclaimer: { textAlign: "center", fontSize: 12, marginTop: 8 },
    button: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12 },
    buttonText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
    restoreBtn: { alignSelf: "center", padding: 16, marginTop: 10 },
    restoreText: { fontSize: 16, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" },
});
