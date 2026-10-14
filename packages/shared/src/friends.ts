/** Where you stand with someone (match_contacts, migration 20261014000013).
 *  "requested" also covers a request they declined — declines are silent. */
export type FriendStatus = "friends" | "requested" | "asked_you" | "none";

/** A contact who's on Raven, as match_contacts returns them. */
export interface ContactMatch {
  /** E.164, exactly as the phone sent it — how a match maps back to a contact. */
  phone: string;
  id: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  status: FriendStatus;
}

/** The words that go with your invite link — shared from Friends, or texted
 *  to a contact who isn't on Raven yet. Opening it asks to be friends. */
export function inviteMessage(url: string): string {
  return `Join me on Raven — I'll send you one when I'm up to something. ${url}`;
}
