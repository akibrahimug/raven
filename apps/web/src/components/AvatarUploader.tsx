"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyError, initials, levelForPoints, type Profile } from "@raven/shared";
import { uploadMedia } from "@/lib/storage";
import { updateAvatarUrl } from "@/lib/actions";

export function AvatarUploader({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(profile.avatar_url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const level = levelForPoints(profile.points);

  async function choosePhoto(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    try {
      const url = await uploadMedia(file);
      const result = await updateAvatarUrl(url);
      if (result?.error) throw new Error(result.error);
      router.refresh();
    } catch (e) {
      setPreview(profile.avatar_url);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={busy}
        className="group relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-[3px] bg-sunken text-2xl font-semibold text-ink-soft disabled:opacity-60"
        style={{ borderColor: level.color }}
        aria-label="Change photo"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          initials(profile.display_name)
        )}
        <span className="absolute inset-0 grid place-items-center bg-ink/0 text-[10px] font-semibold text-transparent transition-colors group-hover:bg-ink/40 group-hover:text-white">
          {busy ? "…" : "Change"}
        </span>
      </button>
      {error ? <p className="text-xs text-late-amber">{error}</p> : null}
    </div>
  );
}
