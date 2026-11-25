import * as Crypto from "expo-crypto";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { Alert } from "@/lib/alert";
import { FzError } from "./api";
import { supabase } from "./supabase";
import i18n from "./i18n";

export type ImageSource = "camera" | "library";

/** Asks for the needed permission at the moment of use, then returns a local URI. */
export async function pickImage(source: ImageSource): Promise<string | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(i18n.t("perm.cameraTitle"), i18n.t("perm.cameraBody"));
      return null;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, exif: false });
    return r.canceled ? null : r.assets[0]?.uri ?? null;
  }
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, exif: false, allowsMultipleSelection: false });
  return r.canceled ? null : r.assets[0]?.uri ?? null;
}

export function chooseImageSource(): Promise<ImageSource | null> {
  return new Promise((resolve) => {
    if (Platform.OS === "web") return resolve("library");
    Alert.alert(i18n.t("upload.chooseTitle"), undefined, [
      { text: i18n.t("upload.camera"), onPress: () => resolve("camera") },
      { text: i18n.t("upload.library"), onPress: () => resolve("library") },
      { text: i18n.t("common.cancel"), style: "cancel", onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}

/** Downscales to max 1600px JPEG (privacy: strips EXIF/GPS metadata). */
export async function compressImage(uri: string): Promise<string> {
  const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1600 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.72 });
  return out.uri;
}

export async function uploadImage(bucket: string, path: string, localUri: string): Promise<string> {
  let uri = localUri;
  try { uri = await compressImage(localUri); } catch { /* keep original if manipulation is unavailable */ }
  const res = await fetch(uri);
  const body = await res.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: "image/jpeg", upsert: true });
  if (error) throw new FzError(/exceeded|size/i.test(error.message) ? "FZ_INVALID_IMAGE_PATH" : "FZ_SERVER_ERROR");
  return path;
}

export function randomId(): string {
  return Crypto.randomUUID();
}

export async function signedUrl(bucket: string, path: string, seconds = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
