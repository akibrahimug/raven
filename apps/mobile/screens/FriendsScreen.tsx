import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { colors, inviteMessage, levelForPoints, type Profile } from "@raven/shared";
import {
  answerFriendRequest,
  fetchActiveFriendRavens,
  fetchFriendRequests,
  fetchFriends,
  withdrawFriendRequest,
  type RequestPerson,
} from "../lib/data";
import { Avatar } from "../components/Avatar";
import { displayText } from "../components/ui";
import { FriendRowsSkeleton } from "../components/Skeleton";

export function FriendsScreen({
  userId,
  inviteUrl,
  refreshKey,
  onBack,
  onOpenRaven,
  onFindContacts,
  onChanged,
}: {
  userId: string;
  inviteUrl: string;
  /** Bumped by App's realtime listener — a friend's raven came or went. */
  refreshKey: number;
  onBack: () => void;
  /** Tapping a friend with a raven out opens it. */
  onOpenRaven: (ravenId: string) => void;
  onFindContacts: () => void;
  /** A request was answered or taken back — App refreshes its counts. */
  onChanged: () => void;
}) {
  // null until the first load lands — "not here yet", not "no one".
  const [friends, setFriends] = useState<Profile[] | null>(null);
  const [requests, setRequests] = useState<{ incoming: RequestPerson[]; outgoing: RequestPerson[] }>({
    incoming: [],
    outgoing: [],
  });
  // Friend id → their newest raven still flying.
  const [flying, setFlying] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchFriends(userId)
      .then(setFriends)
      .catch(() => setFriends([]));
    fetchFriendRequests()
      .then(setRequests)
      .catch(() => {});
    // No dots is a fine fallback — never a reason to lose the list.
    fetchActiveFriendRavens(userId)
      .then(setFlying)
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function act(personId: string, action: () => Promise<void>) {
    setBusy(personId);
    setError(null);
    try {
      await action();
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    await Share.share({ message: inviteMessage(inviteUrl) });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      {requests.incoming.length ? (
        <>
          <Text style={[displayText, styles.sectionTitle]}>Asking to be friends</Text>
          <View style={styles.list}>
            {requests.incoming.map((person, index) => (
              <View
                key={person.id}
                style={[styles.row, index < requests.incoming.length - 1 && styles.rowBorder]}
              >
                <Avatar profile={person} size={34} />
                <Text style={[styles.rowLabel, styles.rowGrow]} numberOfLines={1}>
                  {person.display_name}
                </Text>
                <Pressable
                  onPress={() => act(person.id, () => answerFriendRequest(person.id, false))}
                  disabled={busy === person.id}
                  hitSlop={6}
                >
                  <Text style={styles.muted}>Not now</Text>
                </Pressable>
                <Pressable
                  onPress={() => act(person.id, () => answerFriendRequest(person.id, true))}
                  disabled={busy === person.id}
                  style={({ pressed }) => [styles.accept, pressed && { backgroundColor: colors.accentDeep }]}
                >
                  <Text style={styles.acceptLabel}>{busy === person.id ? "…" : "Accept"}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={onFindContacts}
        style={({ pressed }) => [styles.findButton, pressed && { backgroundColor: colors.accentDeep }]}
      >
        <Text style={styles.findLabel}>Find friends in your contacts</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={[displayText, styles.cardTitle]}>Your invite link</Text>
        <Text style={styles.cardHint}>
          Anyone who opens it asks to be your friend, and you say yes or no. Every raven you send
          flies to all your friends — so only say yes to people you&apos;d actually want turning up.
        </Text>
        <Text style={styles.inviteUrl} numberOfLines={1}>
          {inviteUrl}
        </Text>
        <Pressable
          onPress={share}
          style={({ pressed }) => [styles.shareButton, pressed && { backgroundColor: colors.accentDeep }]}
        >
          <Text style={styles.shareLabel}>Share invite link</Text>
        </Pressable>
      </View>

      {requests.outgoing.length ? (
        <>
          <Text style={[displayText, styles.sectionTitle]}>Waiting on</Text>
          <View style={styles.list}>
            {requests.outgoing.map((person, index) => (
              <View
                key={person.id}
                style={[styles.row, index < requests.outgoing.length - 1 && styles.rowBorder]}
              >
                <Avatar profile={person} size={34} />
                <Text style={[styles.rowLabel, styles.rowGrow]} numberOfLines={1}>
                  {person.display_name}
                </Text>
                <Pressable
                  onPress={() => act(person.id, () => withdrawFriendRequest(person.id))}
                  disabled={busy === person.id}
                  hitSlop={6}
                >
                  <Text style={styles.muted}>{busy === person.id ? "Taking back…" : "Take back"}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Text style={[displayText, styles.sectionTitle]}>Friends</Text>
      {friends === null ? (
        <FriendRowsSkeleton />
      ) : friends.length === 0 ? (
        <Text style={styles.muted}>No one yet — find them in your contacts, or share your link.</Text>
      ) : (
        <View style={styles.list}>
          {friends.map((friend, index) => {
            const level = levelForPoints(friend.points);
            const ravenId = flying.get(friend.id);
            return (
              <Pressable
                key={friend.id}
                onPress={ravenId ? () => onOpenRaven(ravenId) : undefined}
                disabled={!ravenId}
                accessibilityRole={ravenId ? "button" : undefined}
                accessibilityLabel={ravenId ? `${friend.display_name}, has a raven out` : undefined}
                style={({ pressed }) => [
                  styles.row,
                  index < friends.length - 1 && styles.rowBorder,
                  pressed && { backgroundColor: colors.paperSunken },
                ]}
              >
                <View>
                  <Avatar profile={friend} size={34} />
                  {ravenId ? <View style={styles.avatarDot} /> : null}
                </View>
                <View>
                  <Text style={styles.rowLabel}>{friend.display_name}</Text>
                  {ravenId ? <Text style={styles.flying}>Has a raven out</Text> : null}
                </View>
                <Text style={[styles.rowLevel, { color: level.color }]}>{level.name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  scroll: { padding: 20, gap: 16, paddingBottom: 60 },
  back: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  findButton: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  findLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  card: {
    backgroundColor: colors.paperRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  cardTitle: { fontSize: 20 },
  cardHint: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  inviteUrl: {
    backgroundColor: colors.paperSunken,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.inkSoft,
  },
  shareButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  shareLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
  sectionTitle: { fontSize: 20, marginTop: 8 },
  muted: { fontSize: 13, color: colors.inkFaint },
  error: { fontSize: 13, color: colors.late },
  list: {
    backgroundColor: colors.paperRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { fontSize: 15, fontWeight: "600", color: colors.ink },
  rowGrow: { flex: 1 },
  avatarDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.paperRaised,
  },
  flying: { fontSize: 12, color: colors.accent },
  rowLevel: { marginLeft: "auto", fontSize: 12, fontWeight: "700" },
  accept: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  acceptLabel: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
