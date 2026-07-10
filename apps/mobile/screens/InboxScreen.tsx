import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, lifeElapsed, timeLeft, type RsvpStatus } from "@raven/shared";
import { fetchInbox, rsvp, type InboxRaven } from "../lib/data";
import { buzzTap } from "../lib/prefs";
import { Avatar } from "../components/Avatar";
import { Plane, displayText } from "../components/ui";

function attendingLine(raven: InboxRaven, viewerId: string): string | null {
  const attending = raven.recipients.filter(
    (r) => (r.status === "in" || r.status === "late") && r.recipient_id !== viewerId,
  );
  const names = attending.map((r) => {
    const name = r.profile?.display_name ?? "Someone";
    return r.status === "late" ? `${name} (late)` : name;
  });
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is in`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are in`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more are in`;
}

function attendingProfiles(raven: InboxRaven, viewerId: string) {
  return raven.recipients
    .filter((r) => (r.status === "in" || r.status === "late") && r.recipient_id !== viewerId)
    .flatMap((r) => (r.profile ? [r.profile] : []));
}

const RSVP_PILLS: Array<{ status: Exclude<RsvpStatus, "pending">; label: string; color: string }> = [
  { status: "in", label: "I'm in", color: colors.in },
  { status: "late", label: "Running late", color: colors.late },
  { status: "cant", label: "Can't", color: colors.inkFaint },
];

function RavenCard({
  raven,
  viewerId,
  onOpen,
  onChanged,
}: {
  raven: InboxRaven;
  viewerId: string;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const isSender = raven.sender_id === viewerId;
  const me = raven.recipients.find((r) => r.recipient_id === viewerId) ?? null;
  const expired = new Date(raven.expires_at) <= new Date();
  const remaining = Math.max(0, 1 - lifeElapsed(raven.created_at, raven.expires_at));
  const whosIn = attendingLine(raven, viewerId);
  const [localStatus, setLocalStatus] = useState<RsvpStatus | null>(null);
  const status = localStatus ?? me?.status ?? "pending";

  async function respond(next: Exclude<RsvpStatus, "pending">) {
    buzzTap();
    setLocalStatus(next); // optimistic
    try {
      await rsvp(raven.id, viewerId, next);
      onChanged();
    } catch {
      setLocalStatus(null);
    }
  }

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.cardHeader}>
        <View style={styles.senderRow}>
          <Avatar profile={raven.sender} size={28} />
          <Text style={styles.eyebrow}>
            {isSender ? "YOU" : raven.sender.display_name.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.timeLeft}>{timeLeft(raven.expires_at)}</Text>
      </View>
      <Text style={[displayText, styles.body]}>{raven.body}</Text>
      {raven.media_url ? (
        <Image source={{ uri: raven.media_url }} style={styles.media} resizeMode="cover" />
      ) : null}
      {whosIn ? (
        <View style={styles.whosIn}>
          <View style={styles.avatarStack}>
            {attendingProfiles(raven, viewerId)
              .slice(0, 4)
              .map((profile, index) => (
                <View key={profile.id} style={[styles.stackedAvatar, { marginLeft: index === 0 ? 0 : -8 }]}>
                  <Avatar profile={profile} size={22} />
                </View>
              ))}
          </View>
          <Text style={styles.whosInText}>{whosIn}</Text>
        </View>
      ) : null}

      {me && !expired ? (
        <View style={styles.rsvpRow}>
          {RSVP_PILLS.map((pill) => {
            const active = status === pill.status;
            return (
              <Pressable
                key={pill.status}
                onPress={() => respond(pill.status)}
                style={[styles.rsvpPill, active && { borderColor: pill.color, backgroundColor: `${pill.color}1A` }]}
              >
                <Text style={[styles.rsvpLabel, active && { color: pill.color }]}>{pill.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.drainTrack}>
        <View style={[styles.drainFill, { width: `${Math.round(remaining * 100)}%` }]} />
      </View>
    </Pressable>
  );
}

export function InboxScreen({
  userId,
  past,
  refreshKey,
  onOpen,
}: {
  userId: string;
  past: boolean;
  refreshKey: number;
  onOpen: (ravenId: string) => void;
}) {
  const [all, setAll] = useState<InboxRaven[] | null>(null);
  const [sent, setSent] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setAll(await fetchInbox(past));
    } catch {
      // keep whatever we had; pull-to-refresh retries
    }
  }, [past]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const ravens = (all ?? []).filter((raven) =>
    sent ? raven.sender_id === userId : raven.sender_id !== userId,
  );

  return (
    <FlatList
      data={ravens}
      keyExtractor={(raven) => raven.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.accent}
        />
      }
      ListHeaderComponent={
        <View style={styles.tabs}>
          <Pressable onPress={() => setSent(false)} style={[styles.tab, !sent && styles.tabActive]}>
            <Text style={[styles.tabLabel, !sent && styles.tabLabelActive]}>For you</Text>
          </Pressable>
          <Pressable onPress={() => setSent(true)} style={[styles.tab, sent && styles.tabActive]}>
            <Text style={[styles.tabLabel, sent && styles.tabLabelActive]}>Sent</Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Plane size={56} color={colors.inkFaint} />
          <Text style={[displayText, styles.emptyTitle]}>
            {past
              ? "Nothing here yet."
              : sent
                ? "You haven't sent one yet."
                : "The sky is clear."}
          </Text>
          <Text style={styles.emptyHint}>
            {sent
              ? "Tap Send a Raven whenever you're up to something."
              : "When a friend is up to something, it'll land here."}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <RavenCard
          raven={item}
          viewerId={userId}
          onOpen={() => onOpen(item.id)}
          onChanged={load}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 120 },
  tabs: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: colors.paperRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    padding: 4,
    marginBottom: 14,
  },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  tabActive: { backgroundColor: colors.ink },
  tabLabel: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  tabLabelActive: { color: colors.paper },
  card: {
    backgroundColor: colors.paperRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 18,
    paddingBottom: 16,
    overflow: "hidden",
    marginBottom: 14,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: colors.inkSoft },
  timeLeft: { fontSize: 12, color: colors.inkFaint },
  body: { fontSize: 21, lineHeight: 27, marginTop: 8 },
  media: { marginTop: 12, width: "100%", height: 190, borderRadius: 14 },
  whosIn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  avatarStack: { flexDirection: "row" },
  stackedAvatar: { borderRadius: 999, borderWidth: 2, borderColor: colors.paperRaised },
  whosInText: { fontSize: 14, fontWeight: "600", color: colors.in },
  rsvpRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  rsvpPill: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  rsvpLabel: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  drainTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.paperSunken,
  },
  drainFill: { height: 3, backgroundColor: colors.accent, opacity: 0.7 },
  empty: { alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 22, color: colors.inkSoft },
  emptyHint: { fontSize: 14, color: colors.inkFaint, textAlign: "center", maxWidth: 240 },
});
