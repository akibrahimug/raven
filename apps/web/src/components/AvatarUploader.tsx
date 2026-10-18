"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyError, initials, levelForPoints, type Profile } from "@raven/shared";
import { uploadMedia } from "@/lib/storage";
import { preparePhoto } from "@/lib/photo";
import { updateAvatarUrl } from "@/lib/actions";
import { SpinnerIcon } from "@/components/icons";

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
    let localPreview: string | null = null;
    try {
      const prepared = await preparePhoto(file);
      localPreview = URL.createObjectURL(prepared);
      setPreview(localPreview);
      const url = await uploadMedia(prepared);
      const result = await updateAvatarUrl(url);
      if (result?.error) throw new Error(result.error);
      router.refresh();
    } catch (e) {
      setPreview(profile.avatar_url);
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      if (localPreview) URL.revokeObjectURL(localPreview);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={fileInput}
        type="file"
        accept="image/*,.heic,.heif"
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
        <span
          className={`absolute inset-0 grid place-items-center text-[10px] font-semibold transition-colors ${
            busy ? "bg-ink/40 text-white" : "bg-ink/0 text-transparent group-hover:bg-ink/40 group-hover:text-white"
          }`}
        >
          {busy ? <SpinnerIcon className="size-5 animate-spin" /> : "Change"}
        </span>
      </button>
      {error ? <p className="text-xs text-late-amber">{error}</p> : null}
    </div>
  );
}
