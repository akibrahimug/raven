"use client";

import { useRef, useState, useTransition } from "react";
import { friendlyError } from "@raven/shared";
import { sendReply } from "@/lib/actions";
import { uploadMedia } from "@/lib/storage";
import { PhotoIcon, XIcon } from "@/components/icons";

export function ReplyForm({ ravenId }: { ravenId: string }) {
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function pickPhoto(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if ((!trimmed && !photo) || pending) return;
    startTransition(async () => {
      try {
        const mediaUrl = photo ? await uploadMedia(photo) : null;
        const result = await sendReply(ravenId, trimmed, mediaUrl);
        if (result?.error) {
          setError(result.error);
          return;
        }
        setBody("");
        pickPhoto(null);
        setError(null);
      } catch (uploadError) {
        setError(friendlyError(uploadError));
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {preview ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Photo to send" className="max-h-28 rounded-xl border border-line" />
          <button
            type="button"
            onClick={() => pickPhoto(null)}
            aria-label="Remove photo"
            className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-ink text-paper"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => pickPhoto(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label="Add a photo"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-raised text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          <PhotoIcon className="size-5" />
        </button>
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={500}
          placeholder="Reply…"
          className="min-w-0 flex-1 rounded-full border border-line bg-raised px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={(!body.trim() && !photo) || pending}
          className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-40"
        >
          {pending ? "…" : "Send"}
        </button>
      </div>
      {error ? <p className="text-xs text-late-amber">{error}</p> : null}
    </form>
  );
}
