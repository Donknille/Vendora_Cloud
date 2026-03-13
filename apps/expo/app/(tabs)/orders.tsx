import { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { OrderDto as Order } from "@vendora/shared";
import { useTheme } from "@/lib/useTheme";
import { useLanguage } from "@/lib/LanguageContext";
import { useSubscription } from "@/lib/subscription";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency } from "@/lib/formatCurrency";
import { router } from "expo-router";
import { useOrdersQuery } from "@/lib/cloud-queries";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function OrdersScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const { canCreateNewItems } = useSubscription();
  const insets = useSafeAreaInsets();
  const { data: orders = [], refetch, isRefetching } = useOrdersQuery();

  const onRefresh = async () => {
    await refetch();
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const renderOrder = ({ item, index }: { item: Order; index: number }) => (
    <Animated.View entering={FadeInDown.duration(300).delay(index * 50)}>
      <Card
        onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
        style={styles.orderCard}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={[styles.invoiceNum, { color: theme.gold }]}>#{item.invoiceNumber}</Text>
            <Text style={[styles.customerName, { color: theme.text }]}>{item.customerName}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>
        <View style={styles.orderFooter}>
          <Text style={[styles.orderDate, { color: theme.textSecondary }]}>
            {new Date(item.orderDate || item.createdAt).toLocaleDateString("de-DE")}
          </Text>
          <Text style={[styles.orderTotal, { color: theme.text }]}>
            {formatCurrency(item.total)}
          </Text>
        </View>
        <View style={styles.itemCount}>
          <Ionicons name="cube-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.itemCountText, { color: theme.textSecondary }]}>
            {item.items.length} {item.items.length !== 1 ? t.orders.items_plural : t.orders.item}
          </Text>
        </View>
      </Card>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 16 }]}>
        <Text style={[styles.heading, { color: theme.text }]}>{t.orders.title}</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (canCreateNewItems) {
              router.push("/order/new");
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
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={[
          styles.list,
          orders.length === 0 && styles.emptyList,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshing={isRefetching}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={t.orders.noOrders}
            subtitle={t.orders.noOrdersSub}
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
  orderCard: { gap: 12 },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderInfo: { gap: 2 },
  invoiceNum: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  customerName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  orderFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderDate: { fontSize: 13, fontFamily: "Inter_400Regular" },
  orderTotal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  itemCount: { flexDirection: "row", alignItems: "center", gap: 4 },
  itemCountText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
