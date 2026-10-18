import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { friendlyError } from "@raven/shared";
import { supabase } from "./supabase";

// A photo straight off the camera is ~12MP — several MB even as JPEG, more
// than the storage server copes with (uploads time out). Every picked photo
// is shrunk to at most this on its longer side before it goes anywhere.
const MAX_EDGE = 2048;
const QUALITY = 0.8;

export type PickedPhoto = { uri: string; base64: string };

/** Opens the photo library and returns the chosen photo as a modest JPEG,
 *  or null if nothing was picked. HEIC and every other format come out as
 *  JPEG, which shows everywhere — including the web app. */
export async function pickPhoto(
  options: Pick<ImagePicker.ImagePickerOptions, "allowsEditing" | "aspect"> & { maxEdge?: number } = {},
): Promise<PickedPhoto | null> {
  const { maxEdge = MAX_EDGE, ...pickerOptions } = options;
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", ...pickerOptions });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > maxEdge) {
    context.resize(asset.width >= asset.height ? { width: maxEdge, height: null } : { width: null, height: maxEdge });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: true });
  if (!saved.base64) throw new Error("That photo couldn't be opened — try a different one.");
  return { uri: saved.uri, base64: saved.base64 };
}

declare const atob: (data: string) => string;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomId(): string {
  // globalThis.crypto.randomUUID exists on Hermes in current React Native
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Uploads a photo from pickPhoto (as base64) and returns its public URL. */
export async function uploadPhotoBase64(userId: string, base64: string): Promise<string> {
  const path = `${userId}/${randomId()}.jpg`;
  const { error } = await supabase.storage
    .from("raven-media")
    .upload(path, base64ToBytes(base64).buffer as ArrayBuffer, {
      contentType: "image/jpeg",
      // The path is fresh and never reused, so viewers can keep it for good.
      cacheControl: "31536000",
    });
  if (error) throw new Error(friendlyError(error));
  return supabase.storage.from("raven-media").getPublicUrl(path).data.publicUrl;
}
