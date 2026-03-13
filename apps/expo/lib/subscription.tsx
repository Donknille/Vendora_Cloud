import React, { createContext, useContext, useEffect, useState } from "react";
import Purchases, { CustomerInfo, PurchasesOffering } from "react-native-purchases";
import { Platform, Alert } from "react-native";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useAuth } from "./auth";

interface SubscriptionContextType {
    isSubscribed: boolean;
    isInTrial: boolean;
    canCreateNewItems: boolean;
    daysUntilTrialEnds: number;
    customerInfo: CustomerInfo | null;
    currentOffering: PurchasesOffering | null;
    isLoading: boolean;
    purchasePackage: (pkg: any) => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
    bypassSubscription: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType>({} as SubscriptionContextType);

// API Keys should typically be in .env, using placeholder strings for the example architecture
const APIKeys = {
    apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || "public_apple_api_key",
    google: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || "public_google_api_key",
};

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
    const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [demoSubscribed, setDemoSubscribed] = useState(false);

    const isSubscribed = customerInfo?.entitlements.active["pro"] !== undefined || demoSubscribed;

    // Calculate trial status (14 days from account creation)
    const userCreatedAt = new Date(user?.created_at || Date.now());
    const daysSinceCreation = (Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
    const isInTrial = daysSinceCreation <= 14;
    const daysUntilTrialEnds = Math.max(0, Math.ceil(14 - daysSinceCreation));

    const canCreateNewItems = isSubscribed || isInTrial || demoSubscribed;

    useEffect(() => {
        setupRevenueCat();
    }, []);

    useEffect(() => {
        if (Platform.OS === "web") return;

        const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
        if (isExpoGo || !Device.isDevice) return;

        if (isAuthenticated && user) {
            Purchases.logIn(user.id).then(({ customerInfo }) => {
                setCustomerInfo(customerInfo);
            });
        } else {
            Purchases.logOut();
            setCustomerInfo(null);
        }
    }, [isAuthenticated, user]);

    const setupRevenueCat = async () => {
        setIsLoading(true);
        try {
            if (Platform.OS === "web") {
                console.log("RevenueCat is not supported on the web. Skipping setup.");
                return;
            }

            // Expo Go doesn't support custom native code which RevenueCat requires
            // A foolproof way to check if we're in Expo Go is checking the Expo constants execution environment.
            const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

            if (isExpoGo || !Device.isDevice) {
                console.log("RevenueCat is not supported in Expo Go or simulator. Skipping setup.");
                setIsLoading(false);
                return;
            }

            if (Platform.OS === "android") {
                Purchases.configure({ apiKey: APIKeys.google });
            } else if (Platform.OS === "ios") {
                Purchases.configure({ apiKey: APIKeys.apple });
            }

            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null) {
                setCurrentOffering(offerings.current);
            }

            const info = await Purchases.getCustomerInfo();
            setCustomerInfo(info);
        } catch (error) {
            console.error("RevenueCat setup error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const purchasePackage = async (pack: any) => {
        try {
            const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
            if (isExpoGo || !Device.isDevice || Platform.OS === "web") {
                Alert.alert("Demo Modus", "Käufe sind in Expo Go oder im Web nicht möglich. In einer echten Umgebung würdest du nun das Abo abschließen.");
                return false;
            }

            const { customerInfo } = await Purchases.purchasePackage(pack);
            setCustomerInfo(customerInfo);
            return customerInfo.entitlements.active["pro"] !== undefined;
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error("Purchase error", e);
            }
            return false;
        }
    };

    const restorePurchases = async () => {
        try {
            const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
            if (isExpoGo || !Device.isDevice || Platform.OS === "web") {
                Alert.alert("Demo Modus", "Wiederherstellen von Käufen ist in Expo Go oder im Web nicht möglich.");
                return false;
            }

            const customerInfo = await Purchases.restorePurchases();
            setCustomerInfo(customerInfo);
            return customerInfo.entitlements.active["pro"] !== undefined;
        } catch (e) {
            console.error("Restore error", e);
            return false;
        }
    };

    return (
        <SubscriptionContext.Provider
            value={{
                isSubscribed,
                isInTrial,
                canCreateNewItems,
                daysUntilTrialEnds,
                customerInfo,
                currentOffering,
                isLoading,
                purchasePackage,
                restorePurchases,
                bypassSubscription: () => setDemoSubscribed(true),
            }}
        >
            {children}
        </SubscriptionContext.Provider>
    );
}

export const useSubscription = () => useContext(SubscriptionContext);
