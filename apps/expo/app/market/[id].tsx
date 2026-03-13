import { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useLanguage } from "@/lib/LanguageContext";
import { Card } from "@/components/Card";
import { formatCurrency, parseAmount } from "@/lib/formatCurrency";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { confirmAction } from "@/lib/confirmAction";
import {
  useMarketsQuery,
  useMarketSalesQuery,
  useUpdateMarketMutation,
  useCreateMarketMutation,
  useDeleteMarketMutation,
  useCreateMarketSaleMutation,
  useDeleteMarketSaleMutation
} from "@/lib/cloud-queries";

export default function MarketDetailScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: markets = [] } = useMarketsQuery();
  const { data: allSales = [] } = useMarketSalesQuery();

  const [showQuickSale, setShowQuickSale] = useState(false);
  const [saleDesc, setSaleDesc] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [saleQty, setSaleQty] = useState("1");

  const updateMarket = useUpdateMarketMutation();
  const createMarket = useCreateMarketMutation();
  const deleteMarketMutation = useDeleteMarketMutation();
  const createSale = useCreateMarketSaleMutation();
  const deleteSaleMutation = useDeleteMarketSaleMutation();

  const market = markets.find(m => m.id === id) || null;
  const sales = allSales.filter(s => s.market_id === id);

  const toggleMarketStatus = async () => {
    if (!market) return;
    const newStatus = market.status === "closed" ? "open" : "closed";
    await updateMarket.mutateAsync({ id: market.id, data: { status: newStatus } });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const copyMarket = async () => {
    if (!market) return;
    confirmAction(
      "Markt duplizieren?",
      "Möchtest du eine Kopie dieses Marktes anlegen? Dabei werden Name und Schnellwahl-Artikel übernommen. Verkäufe, Standort und Gebühren werden auf 0 gesetzt.",
      "Abbrechen",
      "Kopieren",
      async () => {
        const newMarketData = {
          name: `${market.name} (Kopie)`,
          date: new Date().toISOString(),
          location: "",
          standFee: 0,
          travelCost: 0,
          notes: "",
          status: "open" as const,
          quickItems: market.quickItems ? [...market.quickItems] : [],
        };
        const createResult = await createMarket.mutateAsync(newMarketData);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Da die ID vom Backend erst vergeben wird, müssen wir hoffen, dass das Return-Objekt sie enthält
        // Falls nicht, routen wir zurück zur Übersicht. Idealerweise geben wir die id zurück.
        if (createResult && createResult.id) {
          router.replace({ pathname: "/market/[id]", params: { id: createResult.id } });
        } else {
          router.back();
        }
      }
    );
  };

  const addSale = async () => {
    if (!saleDesc.trim() || !saleAmount.trim()) return;
    await createSale.mutateAsync({
      market_id: id!,
      description: saleDesc.trim(),
      amount: parseAmount(saleAmount),
      quantity: parseInt(saleQty, 10) || 1,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaleDesc("");
    setSaleAmount("");
    setSaleQty("1");
    setShowQuickSale(false);
  };

  const addQuickItemSale = async (name: string, price: number) => {
    await createSale.mutateAsync({
      market_id: id!,
      description: name,
      amount: price,
      quantity: 1,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeLastQuickItemSale = async (name: string, price: number) => {
    const saleToRemove = sales.find(s => s.description === name && s.amount === price);
    if (saleToRemove) {
      await deleteSaleMutation.mutateAsync(saleToRemove.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const deleteSaleAction = (saleId: string) => {
    if (market?.status === "closed") return;
    confirmAction(
      t.markets.deleteSale,
      t.markets.removeSale,
      t.markets.deleteCancel,
      t.markets.deleteAction,
      async () => {
        await deleteSaleMutation.mutateAsync(saleId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    );
  };

  const confirmDeleteMarket = () => {
    confirmAction(
      t.markets.deleteMarket,
      t.markets.deleteMarketConfirm,
      t.markets.deleteCancel,
      t.markets.deleteAction,
      async () => {
        const deletePromises = sales.map((sale) => deleteSaleMutation.mutateAsync(sale.id));
        await Promise.all(deletePromises);
        await deleteMarketMutation.mutateAsync(id!);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      },
    );
  };

  if (!market) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t.common.loading}</Text>
        </View>
      </View>
    );
  }

  const isClosed = market.status === "closed";
  const totalSales = sales.reduce((sum, s) => sum + s.amount * s.quantity, 0);
  const totalCosts = (market.standFee || 0) + (market.travelCost || 0);
  const profit = totalSales - totalCosts;

  type SaleGroup = { description: string; amount: number; quantity: number; ids: string[] };

  // Group sales by description and price
  const groupedSales = sales.reduce((acc, sale) => {
    const key = `${sale.description}-${sale.amount}`;
    if (!acc[key]) {
      acc[key] = {
        description: sale.description,
        amount: sale.amount,
        quantity: 0,
        ids: [],
      };
    }
    acc[key].quantity += sale.quantity;
    acc[key].ids.push(sale.id);
    return acc;
  }, {} as Record<string, SaleGroup>);

  const sortedGroups = (Object.values(groupedSales) as SaleGroup[]).sort((a, b) => a.description.localeCompare(b.description));

  const deleteGroup = (group: SaleGroup) => {
    if (market?.status === "closed") return;
    confirmAction(
      t.markets.deleteSale,
      `Alle ${group.quantity} Einträge für "${group.description}" löschen?`,
      t.markets.deleteCancel,
      t.markets.deleteAction,
      async () => {
        const promises = group.ids.map((groupSaleId: string) => deleteSaleMutation.mutateAsync(groupSaleId));
        await Promise.all(promises);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(400).delay(0)}>
          <Card>
            <View style={styles.headerRow}>
              <View style={[styles.marketIcon, { backgroundColor: theme.gold + "15" }]}>
                <Ionicons name="storefront" size={24} color={theme.gold} />
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.marketName, { color: theme.text }]}>{market.name}</Text>
                <Text style={[styles.marketMeta, { color: theme.textSecondary }]}>
                  {new Date(market.date).toLocaleDateString()}
                  {market.location ? ` \u2022 ${market.location}` : ""}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                  <StatusBadge status={isClosed ? "closed" : "open"} label={isClosed ? "Geschlossen" : "Geöffnet"} color={isClosed ? theme.textSecondary : theme.success} />
                </View>
              </View>
              <View style={{ gap: 8, flexDirection: "row", alignItems: "center" }}>
                <Pressable onPress={() => router.push(`/market/edit/${id}`)} style={{ padding: 8 }}>
                  <Ionicons name="create-outline" size={22} color={theme.textSecondary} />
                </Pressable>
                <Pressable onPress={copyMarket} style={{ padding: 8 }}>
                  <Ionicons name="copy-outline" size={22} color={theme.textSecondary} />
                </Pressable>
                <Pressable onPress={toggleMarketStatus} style={{ padding: 8 }}>
                  <Ionicons name={isClosed ? "lock-closed" : "lock-open-outline"} size={22} color={theme.textSecondary} />
                </Pressable>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.markets.sales}</Text>
            <Text style={[styles.statValue, { color: theme.success }]}>
              {formatCurrency(totalSales)}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.markets.costs}</Text>
            <Text style={[styles.statValue, { color: theme.error }]}>
              {formatCurrency(totalCosts)}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.markets.profit}</Text>
            <Text style={[styles.statValue, { color: profit >= 0 ? theme.gold : theme.error }]}>
              {formatCurrency(profit)}
            </Text>
          </Card>
        </Animated.View>

        {((market.standFee || 0) > 0 || (market.travelCost || 0) > 0) && (
          <Animated.View entering={FadeInDown.duration(400).delay(150)}>
            <Card>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.markets.costBreakdown}</Text>
              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: theme.textSecondary }]}>{t.markets.standFee}</Text>
                <Text style={[styles.costValue, { color: theme.text }]}>
                  {formatCurrency(market.standFee || 0)}
                </Text>
              </View>
              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: theme.textSecondary }]}>{t.markets.travel}</Text>
                <Text style={[styles.costValue, { color: theme.text }]}>
                  {formatCurrency(market.travelCost || 0)}
                </Text>
              </View>
            </Card>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Card>
            <View style={styles.salesHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t.markets.sales}
              </Text>
              {!isClosed && (
                <Pressable
                  testID="toggle-quick-sale"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowQuickSale(!showQuickSale);
                  }}
                  hitSlop={12}
                  style={({ pressed }) => [
                    styles.quickSaleToggle,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name={showQuickSale ? "close-circle" : "add-circle"}
                    size={28}
                    color={theme.gold}
                  />
                </Pressable>
              )}
            </View>

            {!isClosed && market.quickItems && market.quickItems.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 13, marginBottom: 8 }]}>Schnellwahl</Text>
                <View style={{ gap: 10 }}>
                  {market.quickItems.map((item: any, idx: number) => {
                    // Calculate count for this item
                    const count = sales.filter(s => s.description === item.name && s.amount === item.price).length;

                    return (
                      <View key={idx} style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: theme.inputBg,
                        borderColor: theme.border,
                        borderWidth: 1,
                        borderRadius: 12,
                        padding: 12
                      }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{item.name}</Text>
                          <Text style={{ fontSize: 13, color: theme.textSecondary }}>{formatCurrency(item.price)}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Pressable
                            onPress={() => removeLastQuickItemSale(item.name, item.price)}
                            disabled={count === 0}
                            style={({ pressed }) => ({
                              width: 32, height: 32, borderRadius: 16,
                              backgroundColor: theme.background,
                              alignItems: 'center', justifyContent: 'center',
                              borderWidth: 1, borderColor: theme.border,
                              opacity: pressed ? 0.7 : (count === 0 ? 0.3 : 1)
                            })}
                          >
                            <Ionicons name="remove" size={20} color={theme.text} />
                          </Pressable>

                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.text, minWidth: 20, textAlign: 'center' }}>{count}</Text>

                          <Pressable
                            onPress={() => addQuickItemSale(item.name, item.price)}
                            style={({ pressed }) => ({
                              width: 32, height: 32, borderRadius: 16,
                              backgroundColor: theme.gold,
                              alignItems: 'center', justifyContent: 'center',
                              opacity: pressed ? 0.8 : 1
                            })}
                          >
                            <Ionicons name="add" size={20} color="#0D0D0D" />
                          </Pressable>
                        </View>
                      </View>
                    )
                  })}
                </View>
              </View>
            )}

            {showQuickSale && !isClosed && (
              <View style={[styles.quickSaleForm, { borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={saleDesc}
                  onChangeText={setSaleDesc}
                  placeholder={t.markets.itemDescription}
                  placeholderTextColor={theme.textSecondary}
                />
                <View style={styles.quickSaleRow}>
                  <TextInput
                    style={[styles.input, styles.qtyInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                    value={saleQty}
                    onChangeText={setSaleQty}
                    placeholder={t.orders.qty}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={[styles.input, styles.priceInput, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                    value={saleAmount}
                    onChangeText={setSaleAmount}
                    placeholder={t.orders.price}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                  />
                  <Pressable
                    onPress={addSale}
                    style={({ pressed }) => [
                      styles.quickSaleBtn,
                      { backgroundColor: theme.gold },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons name="checkmark" size={22} color="#0D0D0D" />
                  </Pressable>
                </View>
              </View>
            )}

            {sortedGroups.length === 0 ? (
              <View style={styles.emptySales}>
                <Text style={[styles.emptySalesText, { color: theme.textSecondary }]}>
                  {t.markets.noSales}
                </Text>
              </View>
            ) : (
              sortedGroups.map((group, idx) => (
                <Pressable
                  key={idx}
                  onLongPress={() => !isClosed && deleteGroup(group)}
                  style={({ pressed }) => [
                    styles.saleRow,
                    { borderBottomColor: theme.border },
                    pressed && !isClosed && { opacity: 0.7 },
                  ]}
                >
                  <View style={styles.saleInfo}>
                    <Text style={[styles.saleDesc, { color: theme.text }]}>
                      {group.description}
                    </Text>
                    <Text style={[styles.saleMeta, { color: theme.textSecondary }]}>
                      {group.quantity} x {formatCurrency(group.amount)}
                    </Text>
                  </View>
                  <Text style={[styles.saleTotal, { color: theme.success }]}>
                    {formatCurrency(group.amount * group.quantity)}
                  </Text>
                </Pressable>
              ))
            )}
          </Card>
        </Animated.View>

        <Pressable
          onPress={confirmDeleteMarket}
          style={({ pressed }) => [
            styles.deleteBtn,
            { borderColor: theme.error },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="trash-outline" size={18} color={theme.error} />
          <Text style={[styles.deleteBtnText, { color: theme.error }]}>{t.markets.deleteMarket}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatusBadge({ status, label, color }: { status: string; label: string; color: string }) {
  return (
    <View style={{
      backgroundColor: color + '20',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: color
    }}>
      <Text style={{ color: color, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  marketIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerInfo: { flex: 1, gap: 4 },
  marketName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  marketMeta: { fontSize: 14, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 16 },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4 },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 8 },
  costRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  costLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  costValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  salesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  quickSaleToggle: { padding: 4 },
  quickSaleForm: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10, marginBottom: 8 },
  input: { borderRadius: 10, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1 },
  quickSaleRow: { flexDirection: "row", gap: 8 },
  qtyInput: { width: 60 },
  priceInput: { flex: 1 },
  quickSaleBtn: { width: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  emptySales: { paddingVertical: 20, alignItems: "center" },
  emptySalesText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  saleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  saleInfo: { flex: 1, gap: 2 },
  saleDesc: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  saleMeta: { fontSize: 13, fontFamily: "Inter_400Regular" },
  saleTotal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14, borderWidth: 1, marginTop: 8 },
  deleteBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
