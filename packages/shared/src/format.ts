/** "42m left", "3h left", "til Sunday" — the evaporation countdown. */
export function timeLeft(expiresAt: string, now: Date = new Date()): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "expired";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.round(mins / 60);
  if (hours <= 24) return `${hours}h left`;
  const day = new Date(expiresAt).toLocaleDateString("en-GB", { weekday: "long" });
  return `til ${day}`;
}

/** 0..1 share of the raven's lifetime already elapsed — drives the drain line. */
export function lifeElapsed(createdAt: string, expiresAt: string, now: Date = new Date()): number {
  const start = new Date(createdAt).getTime();
  const end = new Date(expiresAt).getTime();
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short" });
}

/** First letter of each of up to two words — the fallback avatar when
 *  someone hasn't set a photo. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Normalise UK national format like 07700 900001 (or the local stack's
 *  01632 960001) to E.164 (+447700900001). */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/[\s()-]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+44${digits.slice(1)}`;
  if (digits.startsWith("447")) return `+${digits}`;
  return `+${digits}`;
}
