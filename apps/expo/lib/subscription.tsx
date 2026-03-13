import React, { createContext, useContext, useEffect, useState } from "react";
import Purchases, { CustomerInfo, PurchasesOffering } from "react-native-purchases";
import { Platform, Alert } from "react-native";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type {
  SubscriptionStateDto,
  SubscriptionStatus,
} from "@vendora/shared";

import {
  useRefreshSubscriptionMutation,
  useSubscriptionStatusQuery,
} from "./cloud-queries";
import { useAuth } from "./auth";

interface SubscriptionContextType {
  status: SubscriptionStatus;
  isSubscribed: boolean;
  isInTrial: boolean;
  canCreateNewItems: boolean;
  daysUntilTrialEnds: number;
  trialEndsAt?: string;
  subscriptionExpiresAt?: string;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  isLoading: boolean;
  purchasePackage: (pkg: any) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshSubscription: () => Promise<SubscriptionStateDto | null>;
}

const SubscriptionContext = createContext<SubscriptionContextType>(
  {} as SubscriptionContextType,
);

const APIKeys = {
  apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || "public_apple_api_key",
  google:
    process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || "public_google_api_key",
};

const ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "pro";

const EMPTY_SUBSCRIPTION_STATE: SubscriptionStateDto = {
  status: "free",
  isSubscribed: false,
  isInTrial: false,
  canCreateNewItems: false,
  daysUntilTrialEnds: 0,
};

function isRevenueCatSupported(): boolean {
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  return Platform.OS !== "web" && !isExpoGo && Device.isDevice;
}

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(
    null,
  );
  const [isRevenueCatLoading, setIsRevenueCatLoading] = useState(true);

  const subscriptionQuery = useSubscriptionStatusQuery();
  const {
    mutateAsync: refreshSubscriptionState,
    isPending: isRefreshingSubscription,
  } = useRefreshSubscriptionMutation();
  const subscriptionState = subscriptionQuery.data ?? EMPTY_SUBSCRIPTION_STATE;

  useEffect(() => {
    let isMounted = true;

    async function setupRevenueCat() {
      setIsRevenueCatLoading(true);

      try {
        if (!isRevenueCatSupported()) {
          if (isMounted) {
            setCurrentOffering(null);
            setCustomerInfo(null);
          }
          return;
        }

        if (Platform.OS === "android") {
          Purchases.configure({ apiKey: APIKeys.google });
        } else if (Platform.OS === "ios") {
          Purchases.configure({ apiKey: APIKeys.apple });
        }

        const offerings = await Purchases.getOfferings();
        if (isMounted) {
          setCurrentOffering(offerings.current ?? null);
        }

        const info = await Purchases.getCustomerInfo();
        if (isMounted) {
          setCustomerInfo(info);
        }
      } catch (error) {
        console.error("RevenueCat setup error:", error);
      } finally {
        if (isMounted) {
          setIsRevenueCatLoading(false);
        }
      }
    }

    void setupRevenueCat();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function syncRevenueCatIdentity() {
      if (!isRevenueCatSupported()) {
        setIsRevenueCatLoading(false);
        return;
      }

      setIsRevenueCatLoading(true);

      try {
        if (!isAuthenticated || !user) {
          await Purchases.logOut();
          if (isMounted) {
            setCustomerInfo(null);
          }
          return;
        }

        const { customerInfo: nextCustomerInfo } = await Purchases.logIn(user.id);
        if (isMounted) {
          setCustomerInfo(nextCustomerInfo);
        }

        await refreshSubscriptionState();
      } catch (error) {
        console.error("RevenueCat identity sync error:", error);
      } finally {
        if (isMounted) {
          setIsRevenueCatLoading(false);
        }
      }
    }

    void syncRevenueCatIdentity();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, refreshSubscriptionState, user?.id]);

  const refreshSubscription = async (): Promise<SubscriptionStateDto | null> => {
    if (!isAuthenticated) {
      return null;
    }

    return refreshSubscriptionState();
  };

  const syncPurchasedEntitlement = async (info: CustomerInfo) => {
    setCustomerInfo(info);

    const hasLocalEntitlement =
      info.entitlements.active[ENTITLEMENT_ID] !== undefined;

    try {
      const refreshedState = await refreshSubscription();
      return refreshedState?.isSubscribed ?? hasLocalEntitlement;
    } catch (error) {
      console.error("Failed to sync subscription status after purchase.", error);

      if (hasLocalEntitlement) {
        Alert.alert(
          "Kauf erfolgreich",
          "Dein Kauf wurde erkannt. Falls Pro nicht sofort freigeschaltet wird, tippe bitte auf 'Restore Purchases'.",
        );
      }

      return hasLocalEntitlement;
    }
  };

  const purchasePackage = async (pack: any) => {
    try {
      if (!isRevenueCatSupported()) {
        Alert.alert(
          "Nicht verfuegbar",
          "Kaeufe sind nur in einem nativen iOS- oder Android-Build verfuegbar.",
        );
        return false;
      }

      const { customerInfo: nextCustomerInfo } =
        await Purchases.purchasePackage(pack);
      return syncPurchasedEntitlement(nextCustomerInfo);
    } catch (error: any) {
      if (!error?.userCancelled) {
        console.error("Purchase error", error);
      }
      return false;
    }
  };

  const restorePurchases = async () => {
    try {
      if (!isRevenueCatSupported()) {
        Alert.alert(
          "Nicht verfuegbar",
          "Wiederherstellen ist nur in einem nativen iOS- oder Android-Build verfuegbar.",
        );
        return false;
      }

      const restoredCustomerInfo = await Purchases.restorePurchases();
      return syncPurchasedEntitlement(restoredCustomerInfo);
    } catch (error) {
      console.error("Restore error", error);
      return false;
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        status: subscriptionState.status,
        isSubscribed: subscriptionState.isSubscribed,
        isInTrial: subscriptionState.isInTrial,
        canCreateNewItems: subscriptionState.canCreateNewItems,
        daysUntilTrialEnds: subscriptionState.daysUntilTrialEnds,
        trialEndsAt: subscriptionState.trialEndsAt,
        subscriptionExpiresAt: subscriptionState.subscriptionExpiresAt,
        customerInfo,
        currentOffering,
        isLoading:
          subscriptionQuery.isLoading ||
          isRefreshingSubscription ||
          isRevenueCatLoading,
        purchasePackage,
        restorePurchases,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
