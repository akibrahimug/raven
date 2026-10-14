import { useEffect, useRef, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "@raven/shared";

// Placeholder shapes for data that's still on its way — the mobile side of
// apps/web/src/components/Skeleton.tsx. A screen opens straight away and
// shows these until its data lands, rather than an empty state that isn't
// true yet. Each is sized like the thing it stands in for.

/** Pulses everything inside it together — one animation per group, not one
 *  per shape — and holds still when Reduce Motion is on. */
export function Pulse({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    );
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!cancelled && !reduce) loop.start();
    });
    return () => {
      cancelled = true;
      loop.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[style, { opacity }]}
      accessible
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
    >
      {children}
    </Animated.View>
  );
}

/** A line of text, a pill, or a circle — sized by the caller. */
export function Bone({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.bone, style]} />;
}

/** Mirrors InboxScreen's card: sender, the message, the RSVP row. */
function RavenCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.senderRow}>
          <Bone style={{ width: 28, height: 28 }} />
          <Bone style={{ width: 80, height: 10 }} />
        </View>
        <Bone style={{ width: 44, height: 10 }} />
      </View>
      <Bone style={{ width: "92%", height: 18, marginTop: 14 }} />
      <Bone style={{ width: "60%", height: 18, marginTop: 9 }} />
      <View style={styles.rsvpRow}>
        <Bone style={{ width: 66, height: 31 }} />
        <Bone style={{ width: 104, height: 31 }} />
        <Bone style={{ width: 58, height: 31 }} />
      </View>
    </View>
  );
}

export function RavenListSkeleton() {
  return (
    <Pulse>
      <RavenCardSkeleton />
      <RavenCardSkeleton />
      <RavenCardSkeleton />
    </Pulse>
  );
}

/** Mirrors FriendsScreen's list: avatar, name, level. */
export function FriendRowsSkeleton() {
  return (
    <Pulse style={styles.list}>
      {[0, 1, 2].map((row) => (
        <View key={row} style={[styles.row, row < 2 && styles.rowBorder]}>
          <Bone style={{ width: 34, height: 34 }} />
          <Bone style={{ width: 110, height: 12 }} />
          <Bone style={{ width: 56, height: 10, marginLeft: "auto" }} />
        </View>
      ))}
    </Pulse>
  );
}

const styles = StyleSheet.create({
  bone: { backgroundColor: colors.paperSunken, borderRadius: 999 },
  card: {
    backgroundColor: colors.paperRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 18,
    paddingBottom: 16,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rsvpRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  list: {
    backgroundColor: colors.paperRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 11 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
});
