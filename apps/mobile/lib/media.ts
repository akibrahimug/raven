import { friendlyError } from "@raven/shared";
import { supabase } from "./supabase";

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

/** Uploads a picked photo (as base64 from expo-image-picker) and returns its
 *  public URL. Screens pick with quality 0.7 so uploads stay small and fast. */
export async function uploadPhotoBase64(userId: string, base64: string): Promise<string> {
  const path = `${userId}/${randomId()}.jpg`;
  const { error } = await supabase.storage
    .from("raven-media")
    .upload(path, base64ToBytes(base64).buffer as ArrayBuffer, { contentType: "image/jpeg" });
  if (error) throw new Error(friendlyError(error));
  return supabase.storage.from("raven-media").getPublicUrl(path).data.publicUrl;
}
