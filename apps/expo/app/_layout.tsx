import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";
import React, { useEffect } from "react";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
  debug: __DEV__, // Set to false in production
});
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient, asyncStoragePersister } from "@/lib/query-client";
import { LanguageProvider, useLanguage } from "@/lib/LanguageContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { useTheme } from "@/lib/useTheme";
import { AuthProvider, useAuth } from "@/lib/auth";
import LockScreen from "./lock-screen";
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

SplashScreen.preventAutoHideAsync();

import { useSubscription } from "@/lib/subscription";

function RootLayoutNav() {
  const theme = useTheme();
  const { t } = useLanguage();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { isSubscribed, isLoading: isSubLoading } = useSubscription();

  if (isAuthLoading || (isAuthenticated && isSubLoading)) return null; // Or a splash screen

  if (!isAuthenticated) return <LockScreen />;

  return (
    <Stack
      screenOptions={({ route }) => ({
        headerBackTitle: "Zurück",
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.gold,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold", color: theme.text },
        contentStyle: { backgroundColor: theme.background },
      })}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="paywall" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen
        name="order/new"
        options={{ title: t.orders.newOrder, presentation: "modal" }}
      />
      <Stack.Screen
        name="order/[id]"
        options={{ title: t.orders.orderDetails }}
      />
      <Stack.Screen
        name="market/new"
        options={{ title: t.markets.newMarket, presentation: "modal" }}
      />
      <Stack.Screen
        name="market/[id]"
        options={{ title: t.markets.marketDetails }}
      />
    </Stack>
  );
}

import { SubscriptionProvider } from "@/lib/subscription";

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <GestureHandlerRootView>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </SubscriptionProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
