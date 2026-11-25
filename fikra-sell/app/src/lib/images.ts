import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type LocalImage = { uri: string; width: number; height: number; remotePath?: string };

const MAX_EDGE = 1600;      // sharp on every phone screen, ~200–400 KB as JPEG
const QUALITY = 0.78;
const MAX_BYTES = 6 * 1024 * 1024;

export async function pickImages(limit: number): Promise<LocalImage[] | 'denied'> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.accessPrivileges !== 'limited') return 'denied';
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: Math.max(1, limit),
    orderedSelection: true,
    quality: 1,
    exif: false,
  });
  if (res.canceled) return [];
  return res.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

export async function takePhoto(): Promise<LocalImage | 'denied' | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return 'denied';
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
  if (res.canceled) return null;
  const a = res.assets[0];
  return { uri: a.uri, width: a.width, height: a.height };
}

/** Resizes to MAX_EDGE on the longest side and re-encodes as JPEG (strips EXIF/GPS). */
export async function compress(img: LocalImage, maxEdge = MAX_EDGE): Promise<LocalImage> {
  const scale = Math.min(1, maxEdge / Math.max(img.width || maxEdge, img.height || maxEdge));
  const ctx = ImageManipulator.manipulate(img.uri);
  if (scale < 1) ctx.resize(img.width >= img.height ? { width: Math.round(img.width * scale) } : { height: Math.round(img.height * scale) });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

function randomName(): string {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 20; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

/** Uploads a compressed JPEG to `bucket/folder/<random>.jpg` and returns the storage path. */
export async function uploadImage(bucket: 'ad-images' | 'avatars' | 'chat-images', folder: string, img: LocalImage): Promise<string> {
  const small = await compress(img, bucket === 'avatars' ? 640 : MAX_EDGE);
  const bytes = await readBytes(small.uri);
  if (bytes.byteLength > MAX_BYTES) throw new Error('image_too_large');
  const path = `${folder}/${randomName()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
  if (error) throw error;
  return path;
}

export async function signedChatImage(path: string): Promise<string | undefined> {
  const { data } = await supabase.storage.from('chat-images').createSignedUrl(path, 60 * 60);
  return data?.signedUrl;
}
