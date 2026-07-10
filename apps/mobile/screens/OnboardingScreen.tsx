import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { colors } from "@raven/shared";
import { createProfile } from "../lib/data";
import { supabase } from "../lib/supabase";
import { Plane, displayText } from "../components/ui";

export function OnboardingScreen({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createProfile(userId, name.trim());
      onDone();
    } catch (e) {
      // A foreign-key failure here means this session's user id no longer
      // exists server-side (e.g. local dev DB was reset). Retrying "Done"
      // can never work — the only way out is a fresh sign-in.
      if (e instanceof Error && e.message.toLowerCase().includes("doesn't exist anymore")) {
        await supabase.auth.signOut();
        return;
      }
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <Plane size={44} />
      <Text style={[displayText, styles.title]}>What do your friends call you?</Text>
      <Text style={styles.hint}>This is the name that lands with your ravens.</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="AK"
        placeholderTextColor={colors.inkFaint}
        maxLength={40}
        autoFocus
        style={styles.input}
      />
      <Pressable
        onPress={submit}
        disabled={!name.trim() || busy}
        style={({ pressed }) => [
          styles.button,
          (!name.trim() || busy) && { opacity: 0.4 },
          pressed && { backgroundColor: colors.accentDeep },
        ]}
      >
        <Text style={styles.buttonLabel}>Done</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable onPress={() => supabase.auth.signOut()} style={styles.signOut}>
        <Text style={styles.signOutLabel}>Not you? Sign out</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  title: { fontSize: 28, marginTop: 10 },
  hint: { fontSize: 14, color: colors.inkSoft },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 18,
    color: colors.ink,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonLabel: { color: "#fff", fontSize: 16, fontWeight: "700" },
  error: { textAlign: "center", color: colors.late, fontSize: 14 },
  signOut: { marginTop: 4, alignSelf: "center" },
  signOutLabel: { fontSize: 13, color: colors.inkFaint, textDecorationLine: "underline" },
});
