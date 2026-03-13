import { useThemeContext } from "@/lib/ThemeContext";

export function useTheme() {
  const { colors } = useThemeContext();
  return colors;
}
