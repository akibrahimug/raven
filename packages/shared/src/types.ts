/** Row types mirror supabase/migrations — keep in sync when the schema changes. */

export type RsvpStatus = "pending" | "in" | "late" | "cant";

export interface Profile {
  id: string;
  display_name: string;
  invite_code: string;
  avatar_url: string | null;
  points: number;
  created_at: string;
}

export interface Friendship {
  user_a: string;
  user_b: string;
  created_at: string;
}

export interface Circle {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface CircleMember {
  circle_id: string;
  friend_id: string;
}

export interface Raven {
  id: string;
  sender_id: string;
  body: string;
  media_url: string | null;
  expires_at: string;
  created_at: string;
}

export interface RavenRecipient {
  raven_id: string;
  recipient_id: string;
  status: RsvpStatus;
  responded_at: string | null;
}

export interface RavenReply {
  id: string;
  raven_id: string;
  author_id: string;
  body: string;
  media_url: string | null;
  created_at: string;
}

/** A raven joined with everything a viewer is allowed to see. */
export interface RavenView {
  raven: Raven;
  sender: Profile;
  /** The viewer's own recipient row; null when the viewer is the sender. */
  me: RavenRecipient | null;
  /** Everyone visible to the viewer: all recipients for the sender, only "in" for recipients. */
  whosIn: Array<{ recipient: RavenRecipient; profile: Profile }>;
  replies: Array<{ reply: RavenReply; author: Profile }>;
}

/** Expiry = the window in which responding still makes sense: how long the
 *  sender is actually around. When it closes, the raven fades for everyone. */
export const EXPIRY_PRESETS = [
  { key: "hour", label: "1 hour", hours: 1 },
  { key: "hours3", label: "3 hours", hours: 3 },
  { key: "today", label: "Today", hours: null }, // until 23:59 local
  { key: "week", label: "This week", hours: null }, // until Sunday 23:59 local
] as const;

export type ExpiryPreset = (typeof EXPIRY_PRESETS)[number]["key"];

export const DEFAULT_EXPIRY_PRESET: ExpiryPreset = "hours3";

/** Compute an absolute expiry timestamp from a preset, in the sender's local time. */
export function expiryFromPreset(preset: ExpiryPreset, now: Date = new Date()): Date {
  const definition = EXPIRY_PRESETS.find((p) => p.key === preset);
  if (definition?.hours != null) {
    return new Date(now.getTime() + definition.hours * 60 * 60 * 1000);
  }
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (preset === "week") {
    const day = end.getDay(); // 0 = Sunday
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    end.setDate(end.getDate() + daysUntilSunday);
  }
  return end;
}

export const RSVP_OPTIONS: Array<{ status: Exclude<RsvpStatus, "pending">; label: string; emoji: string }> = [
  { status: "in", label: "I'm in", emoji: "👍" },
  { status: "late", label: "Running late", emoji: "⏰" },
  { status: "cant", label: "Can't make it", emoji: "🙅" },
];
