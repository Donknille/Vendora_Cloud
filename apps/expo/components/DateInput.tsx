import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";

interface DateInputProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(month: number, year: number) {
  if (month === 1 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month];
}

function formatDisplayDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MONTH_NAMES_DE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export function DateInput({ value, onChange, label, placeholder }: DateInputProps) {
  const theme = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const currentDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth());

  const selectedDate = value ? new Date(value) : null;

  const openPicker = () => {
    if (value) {
      const d = new Date(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
    setShowPicker(true);
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    onChange(toISODate(d));
    setShowPicker(false);
  };

  const daysInMonth = getDaysInMonth(viewMonth, viewYear);
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const dayCells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) dayCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) dayCells.push(d);

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  const isToday = (day: number) => {
    const now = new Date();
    return now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === day;
  };

  const weekDays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <View>
      <Pressable
        testID="date-input"
        onPress={openPicker}
        style={[
          styles.inputBtn,
          {
            backgroundColor: theme.inputBg,
            borderColor: theme.border,
          },
        ]}
      >
        <Ionicons name="calendar-outline" size={18} color={theme.gold} />
        <Text
          style={[
            styles.inputText,
            {
              color: value ? theme.text : theme.textSecondary,
            },
          ]}
        >
          {value ? formatDisplayDate(value) : placeholder || "Datum wählen"}
        </Text>
      </Pressable>

      <Modal visible={showPicker} animationType="fade" transparent>
        <Pressable style={styles.overlay} onPress={() => setShowPicker(false)}>
          <View style={styles.overlayCenter}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={[styles.pickerCard, { backgroundColor: theme.card }]}
            >
              <View style={styles.monthNav}>
                <Pressable onPress={prevMonth} hitSlop={12}>
                  <Ionicons name="chevron-back" size={22} color={theme.text} />
                </Pressable>
                <Text style={[styles.monthLabel, { color: theme.text }]}>
                  {MONTH_NAMES_DE[viewMonth]} {viewYear}
                </Text>
                <Pressable onPress={nextMonth} hitSlop={12}>
                  <Ionicons name="chevron-forward" size={22} color={theme.text} />
                </Pressable>
              </View>

              <View style={styles.weekRow}>
                {weekDays.map((wd) => (
                  <Text key={wd} style={[styles.weekDay, { color: theme.textSecondary }]}>
                    {wd}
                  </Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {dayCells.map((day, i) => (
                  <Pressable
                    key={i}
                    onPress={day ? () => selectDay(day) : undefined}
                    disabled={!day}
                    style={[
                      styles.dayCell,
                      day !== null && isSelected(day) ? { backgroundColor: theme.gold } : undefined,
                      day !== null && isToday(day) && !isSelected(day) ? { borderWidth: 1, borderColor: theme.gold } : undefined,
                    ]}
                  >
                    {day ? (
                      <Text
                        style={[
                          styles.dayText,
                          { color: isSelected(day) ? "#fff" : theme.text },
                          isToday(day) && !isSelected(day) && { color: theme.gold, fontWeight: "700" as const },
                        ]}
                      >
                        {day}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() => {
                  onChange(toISODate(new Date()));
                  setShowPicker(false);
                }}
                style={[styles.todayBtn, { borderColor: theme.border }]}
              >
                <Text style={[styles.todayBtnText, { color: theme.gold }]}>Heute</Text>
              </Pressable>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  inputBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  inputText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayCenter: { width: "90%", maxWidth: 340 },
  pickerCard: {
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  monthLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  weekRow: { flexDirection: "row", marginBottom: 8 },
  weekDay: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  daysGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  dayText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  todayBtn: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  todayBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
