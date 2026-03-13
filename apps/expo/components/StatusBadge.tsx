import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { useLanguage } from "@/lib/LanguageContext";

const STATUS_LABELS: Record<string, Record<string, string>> = {
  en: {
    open: "Open",
    paid: "Paid",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  },
  de: {
    open: "Offen",
    paid: "Bezahlt",
    shipped: "Versendet",
    delivered: "Geliefert",
    cancelled: "Storniert",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const theme = useTheme();
  const { language } = useLanguage();

  const colorMap: Record<string, string> = {
    open: theme.statusOpen,
    paid: theme.statusPaid,
    shipped: theme.statusShipped,
    delivered: theme.statusDelivered,
    cancelled: theme.statusCancelled,
  };

  const color = colorMap[status] || theme.textSecondary;
  const label = STATUS_LABELS[language]?.[status] || status;

  return (
    <View style={[styles.badge, { backgroundColor: color + "20" }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
