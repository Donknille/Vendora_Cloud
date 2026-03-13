const gold = "#C9A961";
const goldLight = "#E8D5A3";
const goldDark = "#A68B4B";
const obsidian = "#0D0D0D";
const obsidianLight = "#1A1A1F";
const obsidianCard = "#1C1C24";
const obsidianElevated = "#252530";
const textPrimary = "#F5F5F5";
const textSecondary = "#8E8E93";
const success = "#34C759";
const error = "#FF3B30";
const warning = "#FF9500";
const info = "#5AC8FA";

export default {
  light: {
    text: "#1C1C1E",
    textSecondary: "#6E6E73",
    background: "#F2F2F7",
    card: "#FFFFFF",
    cardElevated: "#F8F8FC",
    tint: goldDark,
    gold,
    goldLight,
    goldDark,
    border: "#E5E5EA",
    tabIconDefault: "#8E8E93",
    tabIconSelected: goldDark,
    success,
    error,
    warning,
    info,
    inputBg: "#FFFFFF",
    statusOpen: "#5AC8FA",
    statusPaid: "#34C759",
    statusShipped: "#FF9500",
    statusDelivered: "#AF52DE",
    statusCancelled: "#FF3B30",
  },
  dark: {
    text: textPrimary,
    textSecondary,
    background: obsidian,
    card: obsidianCard,
    cardElevated: obsidianElevated,
    tint: gold,
    gold,
    goldLight,
    goldDark,
    border: "#2C2C34",
    tabIconDefault: "#6E6E73",
    tabIconSelected: gold,
    success,
    error,
    warning,
    info,
    inputBg: obsidianLight,
    statusOpen: "#5AC8FA",
    statusPaid: "#34C759",
    statusShipped: "#FF9500",
    statusDelivered: "#AF52DE",
    statusCancelled: "#FF3B30",
  },
};
