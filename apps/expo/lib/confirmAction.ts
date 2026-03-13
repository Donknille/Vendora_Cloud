import { Alert, Platform } from "react-native";

export function confirmAction(
  title: string,
  message: string,
  cancelText: string,
  confirmText: string,
  onConfirm: () => void,
) {
  if (Platform.OS === "web") {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: cancelText, style: "cancel" },
      {
        text: confirmText,
        style: "destructive",
        onPress: onConfirm,
      },
    ]);
  }
}
