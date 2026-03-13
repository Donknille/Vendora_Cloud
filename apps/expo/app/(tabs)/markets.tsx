import { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useLanguage } from "@/lib/LanguageContext";
import { useSubscription } from "@/lib/subscription";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency } from "@/lib/formatCurrency";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMarketsQuery, useMarketSalesQuery } from "@/lib/cloud-queries";


export default function MarketsScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const { canCreateNewItems } = useSubscription();
  const insets = useSafeAreaInsets();
  const { data: markets = [], refetch: refetchMarkets, isRefetching: isRefetchingMarkets } = useMarketsQuery();
  const { data: allSales = [], refetch: refetchSales, isRefetching: isRefetchingSales } = useMarketSalesQuery();

  const isRefetching = isRefetchingMarkets || isRefetchingSales;

  const salesMap = allSales.reduce((acc: Record<string, any[]>, sale) => {
    if (!acc[sale.market_id]) acc[sale.market_id] = [];
    acc[sale.market_id].push(sale);
    return acc;
  }, {});

  const onRefresh = async () => {
    await Promise.all([refetchMarkets(), refetchSales()]);
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const renderMarket = ({ item, index }: { item: any; index: number }) => {
    const sales = salesMap[item.id] || [];
    const totalSales = sales.reduce((sum: number, s: any) => sum + s.amount * s.quantity, 0);
    const totalCosts = (item.stand_fee || 0) + (item.travel_cost || 0);
    const profit = totalSales - totalCosts;

    return (
      <Animated.View entering={FadeInDown.duration(300).delay(index * 50)}>
        <Card
          onPress={() => router.push({ pathname: "/market/[id]", params: { id: item.id } })}
          style={styles.marketCard}
        >
          <View style={styles.marketHeader}>
            <View style={[styles.marketIcon, { backgroundColor: theme.gold + "15" }]}>
              <Ionicons name="storefront-outline" size={20} color={theme.gold} />
            </View>
            <View style={styles.marketInfo}>
              <Text style={[styles.marketName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.marketDate, { color: theme.textSecondary }]}>
                {new Date(item.date).toLocaleDateString()} {item.location ? `\u2022 ${item.location}` : ""}
              </Text>
            </View>
          </View>

          <View style={styles.marketStats}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.markets.sales}</Text>
              <Text style={[styles.statValue, { color: theme.success }]}>
                {formatCurrency(totalSales)}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.markets.costs}</Text>
              <Text style={[styles.statValue, { color: theme.error }]}>
                {formatCurrency(totalCosts)}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.markets.profit}</Text>
              <Text style={[styles.statValue, { color: profit >= 0 ? theme.gold : theme.error }]}>
                {formatCurrency(profit)}
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 16 }]}>
        <Text style={[styles.heading, { color: theme.text }]}>{t.markets.title}</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (canCreateNewItems) {
              router.push("/market/new");
            } else {
              router.push("/paywall");
            }
          }}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: theme.gold },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="add" size={24} color="#0D0D0D" />
        </Pressable>
      </View>

      <FlatList
        data={markets}
        keyExtractor={(item) => item.id}
        renderItem={renderMarket}
        contentContainerStyle={[
          styles.list,
          markets.length === 0 && styles.emptyList,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshing={isRefetching}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="storefront-outline"
            title={t.markets.noMarkets}
            subtitle={t.markets.noMarketsSub}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8 },
  heading: { fontSize: 28, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, gap: 12 },
  emptyList: { flex: 1 },
  marketCard: { gap: 16 },
  marketHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  marketIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  marketInfo: { flex: 1, gap: 2 },
  marketName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  marketDate: { fontSize: 13, fontFamily: "Inter_400Regular" },
  marketStats: { flexDirection: "row", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  divider: { width: 1, height: 30 },
});
