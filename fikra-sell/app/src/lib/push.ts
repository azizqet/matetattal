import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { registerPushToken } from './api';
import { env } from './env';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

/**
 * Registers this device for Expo push notifications. Remote push is not
 * available inside Expo Go on Android (SDK 53+) — the development / store
 * builds support it; inside Expo Go the in-app notification centre still works.
 */
export async function registerForPush(): Promise<'ok' | 'denied' | 'unsupported'> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient && Platform.OS === 'android') return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'عام', importance: AndroidImportance.DEFAULT });
    await Notifications.setNotificationChannelAsync('messages', { name: 'الرسائل', importance: AndroidImportance.HIGH, vibrationPattern: [0, 200, 120, 200] });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  if (!env.easProjectId) return 'unsupported';
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: env.easProjectId });
  await registerPushToken(data, Platform.OS as 'ios' | 'android');
  return 'ok';
}

export function routeFromNotificationData(data: Record<string, unknown> | undefined) {
  if (!data) return;
  if (typeof data.conversation_id === 'string') router.push(`/chat/${data.conversation_id}`);
  else if (data.ticket_id) router.push(`/support/${data.ticket_id}`);
  else if (data.ad_id) router.push(`/ad/${data.ad_id}`);
  else router.push('/notifications');
}

export function listenForNotificationTaps(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => routeFromNotificationData(r.notification.request.content.data));
  Notifications.getLastNotificationResponseAsync().then((r) => { if (r) routeFromNotificationData(r.notification.request.content.data); }).catch(() => {});
  return () => sub.remove();
}
