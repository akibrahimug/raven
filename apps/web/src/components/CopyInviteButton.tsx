"use client";

import { inviteMessage } from "@raven/shared";

import { useState } from "react";

export function CopyInviteButton({ url, senderName }: { url: string; senderName: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = inviteMessage(url);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // fall through to clipboard when the user dismisses the sheet
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={share}
      className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep active:scale-[0.97]"
      aria-label={`Share ${senderName}'s invite link`}
    >
      {copied ? "Copied" : "Share invite link"}
    </button>
  );
}
