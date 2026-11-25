import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { rpc } from "./api";
import { EAS_PROJECT_ID } from "./config";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

/** Registers the Expo push token for the signed-in user (asks permission once, after login). */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice || !EAS_PROJECT_ID) return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "FAZZA", importance: AndroidImportance.HIGH });
    await Notifications.setNotificationChannelAsync("orders", {
      name: "New delivery requests", importance: AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250],
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    if (data && data !== registeredToken) {
      await rpc("register_push_token", { p_token: data, p_platform: Platform.OS });
      registeredToken = data;
    }
    return data;
  } catch {
    return null;
  }
}

export async function unregisterPush() {
  if (registeredToken) {
    await rpc("unregister_push_token", { p_token: registeredToken }).catch(() => undefined);
    registeredToken = null;
  }
}
