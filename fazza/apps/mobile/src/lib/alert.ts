/**
 * Cross-platform Alert: native Alert on iOS/Android, window dialogs on web
 * (react-native-web's Alert.alert is a no-op).
 */
import { Alert as RNAlert, Platform, type AlertButton, type AlertOptions } from "react-native";

function webAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const text = [title, message].filter(Boolean).join("\n\n");
  const actions = (buttons ?? []).filter((b) => b.style !== "cancel");
  const cancel = (buttons ?? []).find((b) => b.style === "cancel");
  if (actions.length === 0) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  if (window.confirm(text)) actions[0].onPress?.();
  else cancel?.onPress?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    if (Platform.OS === "web") return webAlert(title, message, buttons);
    return RNAlert.alert(title, message, buttons, options);
  },
};
