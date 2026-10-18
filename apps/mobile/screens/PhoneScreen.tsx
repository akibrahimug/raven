import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { colors, friendlyError, isTestNumber, normalisePhone } from "@raven/shared";
import { supabase } from "../lib/supabase";
import { Plane, displayText, Busy } from "../components/ui";
import { DeleteAccountLink } from "../components/DeleteAccountLink";

/** Step two of signing up, after Google or the email link — mirrors the web
 *  /phone page. The number is what this account logs back in with, so
 *  App.tsx shows nothing else until it's verified. */
export function PhoneScreen({
  userId,
  onNumberTaken,
  onDeleted,
}: {
  userId: string;
  onNumberTaken: (phone: string) => void;
  onDeleted: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    const number = normalisePhone(phone);
    if (isTestNumber(number)) {
      setError("That number's kept for testing — use your own.");
      return;
    }
    setBusy(true);
    setError(null);
    // The server texts the number a code and changes nothing until it's back.
    const { error } = await supabase.auth.updateUser({ phone: number });
    if (error?.code === "phone_exists") {
      // Already someone's account — that's a log in, not a sign-up.
      onNumberTaken(number);
      return;
    }
    setBusy(false);
    if (error) setError(friendlyError(error));
    else setStep("code");
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      phone: normalisePhone(phone),
      token: code.trim(),
      type: "phone_change",
    });
    setBusy(false);
    if (error) setError(friendlyError(error));
    // Success: the auth listener in App.tsx sees the verified number.
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <Plane size={44} />
      <Text style={[displayText, styles.title]}>What's your number?</Text>
      <Text style={styles.hint}>It's how you log in to Raven. We'll text you a code to check it's yours.</Text>

      {step === "phone" ? (
        <>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="07700 900001"
            placeholderTextColor={colors.inkFaint}
            keyboardType="phone-pad"
            autoComplete="tel"
            autoFocus
            style={styles.input}
          />
          <Pressable
            onPress={requestCode}
            disabled={busy || phone.trim().length < 10}
            style={({ pressed }) => [
              styles.button,
              (busy || phone.trim().length < 10) && styles.buttonDisabled,
              pressed && { backgroundColor: colors.accentDeep },
            ]}
          >
            <Busy pending={busy}>
              <Text style={styles.buttonLabel}>Text me a code</Text>
            </Busy>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.label}>THE CODE WE TEXTED {normalisePhone(phone)}</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            autoFocus
            style={[styles.input, styles.codeInput]}
          />
          <Pressable
            onPress={verify}
            disabled={busy || code.trim().length < 6}
            style={({ pressed }) => [
              styles.button,
              (busy || code.trim().length < 6) && styles.buttonDisabled,
              pressed && { backgroundColor: colors.accentDeep },
            ]}
          >
            <Busy pending={busy}>
              <Text style={styles.buttonLabel}>Verify number</Text>
            </Busy>
          </Pressable>
          <Pressable
            onPress={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
          >
            <Text style={styles.secondary}>Different number</Text>
          </Pressable>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={() => supabase.auth.signOut()} style={styles.signOut}>
        <Text style={styles.signOutLabel}>Not you? Sign out</Text>
      </Pressable>
      <DeleteAccountLink userId={userId} onDeleted={onDeleted} style={styles.signOut} />
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
  label: {
    marginTop: 12,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: colors.inkSoft,
  },
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
  codeInput: { marginTop: 0, textAlign: "center", letterSpacing: 10, fontSize: 24 },
  button: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondary: { textAlign: "center", color: colors.inkFaint, fontSize: 14, paddingVertical: 8 },
  error: { textAlign: "center", color: colors.late, fontSize: 14 },
  signOut: { marginTop: 4, alignSelf: "center" },
  signOutLabel: { fontSize: 13, color: colors.inkFaint, textDecorationLine: "underline" },
});
