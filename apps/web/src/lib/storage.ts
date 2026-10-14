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

/** Deletes every photo in the signed-in user's folder: the first half of
 *  deleting an account, which the database won't do while any are left
 *  (migration 20261014000012). One request per file — the live server's
 *  Oracle Object Storage rejects the bulk delete supabase-js sends
 *  ("Missing required header: Content-MD5…") — a few at a time, and from the
 *  browser, so an account with lots of photos can't hit a server time limit. */
export async function deleteOwnPhotos(): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("You've been signed out — sign in again.");
  const folder = session.user.id;
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/raven-media/${folder}`;
  const headers = {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${session.access_token}`,
  };
  for (let page = 0; page < 100; page++) {
    const { data: files, error } = await supabase.storage.from("raven-media").list(folder, { limit: 100 });
    if (error) throw new Error(friendlyError(error));
    if (!files.length) return;
    for (let i = 0; i < files.length; i += 5) {
      const responses = await Promise.all(
        files
          .slice(i, i + 5)
          .map((file) => fetch(`${base}/${encodeURIComponent(file.name)}`, { method: "DELETE", headers })),
      );
      if (responses.some((response) => !response.ok)) {
        throw new Error("Couldn't delete your photos — try again.");
      }
    }
  }
  throw new Error("Couldn't delete your photos — try again.");
}

