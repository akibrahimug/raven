const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Your invite link — opening it asks to be your friend. */
export function inviteUrlFor(inviteCode: string): string {
  return `${APP_URL}/j/${inviteCode}`;
}
