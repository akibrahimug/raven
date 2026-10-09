"use client";

import { useRef, useState, useTransition } from "react";
import { friendlyError } from "@raven/shared";
import { sendReply } from "@/lib/actions";
import { uploadMedia } from "@/lib/storage";
import type { ReplyRow } from "@/lib/data";
import { PhotoIcon, XIcon } from "@/components/icons";

export function ReplyForm({
  ravenId,
  viewerId,
  onOptimistic,
  onReconcile,
  onFailed,
}: {
  ravenId: string;
  viewerId: string;
  /** Called synchronously on submit, before any network call — this is what
   *  makes a reply "appear instantly": the bubble renders before the server
   *  has even been asked, not just an unlocked send button. */
  onOptimistic: (reply: ReplyRow) => void;
  /** Swaps the optimistic bubble for the real row once the insert succeeds. */
  onReconcile: (tempId: string, real: ReplyRow) => void;
  /** Removes the optimistic bubble on failure — the error message covers
   *  telling the user, this just undoes the premature "it sent" signal. */
  onFailed: (tempId: string) => void;
}) {
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

    const tempId = `pending-${crypto.randomUUID()}`;
    // The local blob preview doubles as the optimistic bubble's image — no
    // need to wait for the real upload to show *something* in the thread.
    const optimisticMediaUrl = preview;
    const optimistic: ReplyRow = {
      id: tempId,
      raven_id: ravenId,
      author_id: viewerId,
      body: trimmed,
      media_url: optimisticMediaUrl,
      created_at: new Date().toISOString(),
      author: null, // "mine" bubbles never render the author label anyway
    };
    onOptimistic(optimistic);

    // Clear immediately — the bubble is already showing the content, so
    // holding the input hostage until the network call resolves would be a
    // regression back to "did my click do anything."
    setBody("");
    pickPhoto(null);
    setError(null);

    startTransition(async () => {
      try {
        const mediaUrl = photo ? await uploadMedia(photo) : null;
        const result = await sendReply(ravenId, trimmed, mediaUrl);
        if (result?.error || !result?.reply) {
          onFailed(tempId);
          setError(result?.error ?? "Could not send.");
          setBody(trimmed);
          return;
        }
        onReconcile(tempId, result.reply as ReplyRow);
      } catch (uploadError) {
        onFailed(tempId);
        setError(friendlyError(uploadError));
        setBody(trimmed);
      } finally {
        if (optimisticMediaUrl) URL.revokeObjectURL(optimisticMediaUrl);
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
          disabled={!body.trim() && !photo}
          className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep active:scale-[0.97] disabled:opacity-40"
        >
          Send
        </button>
      </div>
      {error ? <p className="text-xs text-late-amber">{error}</p> : null}
    </form>
  );
}
