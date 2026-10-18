import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path, Polygon } from "react-native-svg";
import { colors } from "@raven/shared";

/** The raven — same classic paper plane as the web app. */
export function Plane({ size = 24, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Polygon points="45,4 3,25 19,31" fill={color} opacity={0.9} />
      <Polygon points="45,4 19,31 28,44" fill={color} />
      <Polygon points="19,31 19,41 25,36" fill={color} opacity={0.45} />
    </Svg>
  );
}

/** Matches apps/web/src/components/icons.tsx LocationIcon exactly — same
 *  mark on both platforms, no emoji (the app's rendered UI avoids them
 *  entirely; RSVP_OPTIONS.emoji in @raven/shared is legacy and unused here). */
export function LocationPin({ size = 16, color = colors.inkSoft }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9.5} r={2.4} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

/** A button's contents, swapped for a spinner while it works. The label
 *  stays laid out but hidden, so the button keeps its exact size.
 *  `style` lays out the label (e.g. an icon beside text). */
export function Busy({
  pending,
  color = "#fff",
  style,
  children,
}: {
  pending: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <View>
      <View style={[style, pending && styles.hidden]}>{children}</View>
      {pending ? (
        <View style={styles.spinner} accessibilityLabel="Working">
          <ActivityIndicator size="small" color={color} />
        </View>
      ) : null}
    </View>
  );
}

export function Pill({
  label,
  onPress,
  active = false,
  activeColor = colors.ink,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  activeColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        active && { backgroundColor: activeColor, borderColor: activeColor },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text style={[styles.pillLabel, active && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  spinner: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  pill: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkSoft,
  },
});

/** Big, round display text — the mobile stand-in for the web's display font.
 *  System font keeps startup instant; a custom font can land later. */
export const displayText = {
  fontWeight: "700" as const,
  letterSpacing: -0.4,
  color: colors.ink,
};
