import { useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { colors, levelForPoints, type Profile } from "@raven/shared";
import { fetchFriends } from "../lib/data";
import { Avatar } from "../components/Avatar";
import { displayText } from "../components/ui";
import { FriendRowsSkeleton } from "../components/Skeleton";

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? "http://localhost:3000";

export function FriendsScreen({
  userId,
  inviteCode,
  onBack,
}: {
  userId: string;
  inviteCode: string;
  onBack: () => void;
}) {
  // null until the first load lands — "not here yet", not "no one".
  const [friends, setFriends] = useState<Profile[] | null>(null);
  const inviteUrl = `${APP_URL}/j/${inviteCode}`;

  useEffect(() => {
    fetchFriends(userId)
      .then(setFriends)
      .catch(() => setFriends([]));
  }, [userId]);

  async function share() {
    await Share.share({
      message: `Join me on Raven — I'll send you one when I'm up to something. ${inviteUrl}`,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={[displayText, styles.cardTitle]}>Your invite link</Text>
        <Text style={styles.cardHint}>
          Every raven you send flies to everyone here — so only invite people you&apos;d actually
          want turning up.
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

      <Text style={[displayText, styles.sectionTitle]}>Friends</Text>
      {friends === null ? (
        <FriendRowsSkeleton />
      ) : friends.length === 0 ? (
        <Text style={styles.muted}>No one yet — share your link above.</Text>
      ) : (
        <View style={styles.list}>
          {friends.map((friend, index) => {
            const level = levelForPoints(friend.points);
            return (
              <View
                key={friend.id}
                style={[styles.row, index < friends.length - 1 && styles.rowBorder]}
              >
                <Avatar profile={friend} size={34} />
                <Text style={styles.rowLabel}>{friend.display_name}</Text>
                <Text style={[styles.rowLevel, { color: level.color }]}>{level.name}</Text>
              </View>
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
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  shareLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
  sectionTitle: { fontSize: 20, marginTop: 8 },
  muted: { fontSize: 13, color: colors.inkFaint },
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
  rowLevel: { marginLeft: "auto", fontSize: 12, fontWeight: "700" },
});
