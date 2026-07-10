import { friendlyError } from "@raven/shared";
import { createClient } from "@/lib/supabase/client";

/** Uploads a photo to the caller's folder in raven-media and returns its
 *  public URL. Paths are uuid-based, so URLs are unguessable. */
export async function uploadMedia(file: File): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You've been signed out — sign in again.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("raven-media").upload(path, file, {
    contentType: file.type || undefined,
  });
  if (error) throw new Error(friendlyError(error));
  return supabase.storage.from("raven-media").getPublicUrl(path).data.publicUrl;
}
