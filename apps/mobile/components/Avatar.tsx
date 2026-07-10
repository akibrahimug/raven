import { Image, StyleSheet, Text, View } from "react-native";
import { colors, initials, levelForPoints, type Profile } from "@raven/shared";

/** A friend's face: their photo if they've set one, otherwise their
 *  initials. Ringed in their level colour. */
export function Avatar({
  profile,
  size = 32,
}: {
  profile: Pick<Profile, "display_name" | "avatar_url" | "points">;
  size?: number;
}) {
  const level = levelForPoints(profile.points);
  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: level.color,
        },
      ]}
    >
      {profile.avatar_url ? (
        <Image
          source={{ uri: profile.avatar_url }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text style={{ fontSize: size * 0.38, fontWeight: "700", color: colors.inkSoft }}>
          {initials(profile.display_name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2,
    backgroundColor: colors.paperSunken,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
