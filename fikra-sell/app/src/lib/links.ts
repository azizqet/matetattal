import * as Linking from 'expo-linking';
import { Share } from 'react-native';
import { env } from './env';
import { whatsappNumber } from './format';

/** Shareable link: https web link when a web domain is configured, else the app deep link. */
export function adUrl(id: number): string {
  return env.webBase ? `${env.webBase.replace(/\/$/, '')}/ad/${id}` : Linking.createURL(`/ad/${id}`);
}

export async function shareText(message: string, url?: string) {
  await Share.share(url ? { message, url } : { message });
}

export function call(phone: string) {
  return Linking.openURL(`tel:${phone}`);
}

export function whatsapp(phone: string, text: string) {
  return Linking.openURL(`https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(text)}`);
}
