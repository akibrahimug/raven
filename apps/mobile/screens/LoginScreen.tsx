import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AUTH_NOTICES, colors, friendlyError, normalisePhone, type AuthNotice } from "@raven/shared";
import { supabase } from "../lib/supabase";
import { Plane, displayText, Busy } from "../components/ui";

export function LoginScreen({
  notice,
  initialPhone,
  onUseSignup,
}: {
  notice?: AuthNotice;
  /** A number typed during sign-up that turned out to have an account. */
  initialPhone?: string;
  onUseSignup: (notice?: AuthNotice) => void;
}) {
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalisePhone(phone),
      // Logging in never makes an account — signing up starts with email.
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error?.code === "otp_disabled") {
      // No account has this number.
      onUseSignup("no-account");
      return;
    }
    if (error) setError(friendlyError(error));
    else setStep("code");
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      phone: normalisePhone(phone),
      token: code.trim(),
      type: "sms",
    });
    setBusy(false);
    if (error) setError(friendlyError(error));
    // Success: the auth listener in App.tsx takes over.
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.hero}>
        <Plane size={64} />
        <Text style={[displayText, styles.wordmark]}>Raven</Text>
        <Text style={styles.tagline}>Plans, not group chats.</Text>
      </View>

      {step === "phone" ? (
        <View style={styles.form}>
          {notice ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>{AUTH_NOTICES[notice]}</Text>
            </View>
          ) : null}
          <Text style={styles.label}>YOUR PHONE NUMBER</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="07700 900001"
            placeholderTextColor={colors.inkFaint}
            keyboardType="phone-pad"
            autoComplete="tel"
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
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>THE CODE WE TEXTED {normalisePhone(phone)}</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
            autoComplete="one-time-code"
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
              <Text style={styles.buttonLabel}>Sign in</Text>
            </Busy>
          </Pressable>
          <Pressable onPress={() => setStep("phone")}>
            <Text style={styles.secondary}>Different number</Text>
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={() => onUseSignup()} style={{ marginTop: 24 }}>
        <Text style={styles.secondary}>New here? Sign up</Text>
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
  },
  hero: { alignItems: "center", gap: 6 },
  wordmark: { fontSize: 42, marginTop: 8 },
  tagline: { fontSize: 16, color: colors.inkSoft },
  form: { marginTop: 44, gap: 10 },
  noticeBox: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 18,
    padding: 18,
    marginBottom: 6,
  },
  noticeText: { fontSize: 14, color: colors.inkSoft, textAlign: "center" },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: colors.inkSoft,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 18,
    color: colors.ink,
  },
  codeInput: { textAlign: "center", letterSpacing: 10, fontSize: 24 },
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
  error: { marginTop: 14, textAlign: "center", color: colors.late, fontSize: 14 },
});
