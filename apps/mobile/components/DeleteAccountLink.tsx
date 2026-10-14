import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@raven/shared";
import { deleteAccount } from "../lib/data";

/** "Delete account", for Settings and for the sign-up steps before it (a
 *  sign-up abandoned at the phone or name step can't reach Settings). It
 *  can't be undone, so the system dialog spells out what goes first. */
export function DeleteAccountLink({
  userId,
  onDeleted,
  style,
}: {
  userId: string;
  /** The account is gone — App.tsx signs this device out. */
  onDeleted: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    Alert.alert(
      "Delete your account?",
      "Your profile, friends, ravens, replies and photos go for good. This can't be undone.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              await deleteAccount(userId);
              onDeleted();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not delete your account.");
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <>
      <Pressable onPress={confirm} disabled={deleting} style={style}>
        <Text style={styles.label}>{deleting ? "Deleting…" : "Delete account"}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: colors.inkFaint, textDecorationLine: "underline" },
  error: { fontSize: 12, color: colors.late, textAlign: "center" },
});
