"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  CUSTOM_EXPIRY_HOURS_MAX,
  CUSTOM_EXPIRY_HOURS_MIN,
  DEFAULT_EXPIRY_PRESET,
  EXPIRY_PRESETS,
  expiryFromCustomHours,
  expiryFromPreset,
  friendlyError,
  type ExpiryPreset,
} from "@raven/shared";
import { sendRaven } from "@/lib/actions";
import { uploadMedia } from "@/lib/storage";
import { RavenMark } from "@/components/RavenMark";
import { LocationIcon, PhotoIcon, XIcon } from "@/components/icons";

const GLIDE_MS = 1100;
const DEFAULT_CUSTOM_HOURS = "6";

type ExpiryChoice = ExpiryPreset | "custom";

export function ComposeForm({ friendCount }: { friendCount: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [preset, setPreset] = useState<ExpiryChoice>(DEFAULT_EXPIRY_PRESET);
  const [customHours, setCustomHours] = useState(DEFAULT_CUSTOM_HOURS);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [addingLocation, setAddingLocation] = useState(false);
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [gliding, setGliding] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const locationInput = useRef<HTMLInputElement>(null);

  const customHoursValid =
    preset !== "custom" ||
    (Number(customHours) >= CUSTOM_EXPIRY_HOURS_MIN && Number(customHours) <= CUSTOM_EXPIRY_HOURS_MAX);
  const ready = body.trim().length > 0 && friendCount > 0 && customHoursValid;

  function pickPhoto(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function openLocation() {
    setAddingLocation(true);
    // Input isn't mounted yet on this same tick — focus next frame.
    requestAnimationFrame(() => locationInput.current?.focus());
  }

  function removeLocation() {
    setAddingLocation(false);
    setLocation("");
  }

  function expiresAt(): Date {
    return preset === "custom" ? expiryFromCustomHours(Number(customHours)) : expiryFromPreset(preset);
  }

  function submit() {
    if (!ready || pending) return;
    setError(null);
    setGliding(true);
    startTransition(async () => {
      let mediaUrl: string | null = null;
      if (photo) {
        try {
          mediaUrl = await uploadMedia(photo);
        } catch (uploadError) {
          setGliding(false);
          setError(friendlyError(uploadError));
          return;
        }
      }
      const glideDone = new Promise((resolve) => setTimeout(resolve, GLIDE_MS));
      const result = await sendRaven({
        body,
        expiresAt: expiresAt().toISOString(),
        mediaUrl,
        location: location.trim() || null,
      });
      await glideDone;
      if (result?.error) {
        setGliding(false);
        setError(result.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-7">
      <textarea
        autoFocus
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={280}
        rows={3}
        placeholder="What's happening?"
        className="invitation w-full resize-none rounded-2xl border border-line bg-raised px-5 py-4 text-2xl text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
      />

      <div className="-mt-3 flex flex-wrap items-start gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => pickPhoto(event.target.files?.[0] ?? null)}
        />
        {preview ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Photo to send" className="max-h-44 rounded-2xl border border-line" />
            <button
              type="button"
              onClick={() => pickPhoto(null)}
              aria-label="Remove photo"
              className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-ink text-paper"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-2 rounded-full border border-line bg-raised px-3.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent"
          >
            <PhotoIcon className="size-4.5" />
            Add a photo
          </button>
        )}

        {addingLocation ? (
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-raised py-1 pl-3.5 pr-1.5">
            <LocationIcon className="size-4 shrink-0 text-ink-soft" />
            <input
              ref={locationInput}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              maxLength={140}
              placeholder="Where?"
              className="w-40 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <button
              type="button"
              onClick={removeLocation}
              aria-label="Remove location"
              className="grid size-6 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-sunken hover:text-ink"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openLocation}
            className="flex items-center gap-2 rounded-full border border-line bg-raised px-3.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent"
          >
            <LocationIcon className="size-4.5" />
            Add a location
          </button>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
          I&apos;m around for
        </p>
        <div className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-raised p-1">
          {EXPIRY_PRESETS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPreset(option.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                preset === option.key ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPreset("custom")}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              preset === "custom" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
            }`}
          >
            Custom
          </button>
        </div>
        {preset === "custom" ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={customHours}
              onChange={(event) => setCustomHours(event.target.value)}
              min={CUSTOM_EXPIRY_HOURS_MIN}
              max={CUSTOM_EXPIRY_HOURS_MAX}
              step={0.5}
              className={`w-20 rounded-xl border bg-raised px-3 py-1.5 text-sm text-ink focus:outline-none ${
                customHoursValid ? "border-line focus:border-accent" : "border-late-amber"
              }`}
            />
            <span className="text-sm text-ink-soft">hours</span>
            {!customHoursValid ? (
              <span className="text-xs text-late-amber">
                Between {CUSTOM_EXPIRY_HOURS_MIN} and {CUSTOM_EXPIRY_HOURS_MAX}
              </span>
            ) : null}
          </div>
        ) : null}
        <p className="mt-1.5 text-xs text-ink-faint">
          When you&apos;re gone, the raven fades for everyone.
        </p>
      </div>

      {error ? <p className="text-sm text-late-amber">{error}</p> : null}

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!ready || pending}
          className="flex items-center gap-2.5 rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-white transition hover:bg-accent-deep active:scale-[0.97] disabled:opacity-40"
        >
          <RavenMark className="size-5 text-white" />
          Send the Raven
        </button>
        <p className="text-xs text-ink-faint">
          {friendCount === 0
            ? "No friends yet — share your invite link from the Friends page first."
            : `Flies to all ${friendCount} of your friends. They decide.`}
        </p>
      </div>

      {gliding ? (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-paper/60">
          <RavenMark className="raven-glide size-24 text-accent" />
        </div>
      ) : null}
    </div>
  );
}
