import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Polygon } from "react-native-svg";
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
