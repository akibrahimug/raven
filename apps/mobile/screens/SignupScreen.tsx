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
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Svg, { Path } from "react-native-svg";
import { AUTH_NOTICES, colors, friendlyError, type AuthNotice } from "@raven/shared";
import { supabase } from "../lib/supabase";
import { Plane, displayText, Busy } from "../components/ui";

const REDIRECT_URL = Linking.createURL("auth/callback");

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.48a5.55 5.55 0 0 1-2.4 3.64v3h3.88c2.27-2.09 3.56-5.17 3.56-8.82Z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3a7.4 7.4 0 0 1-11-3.89H.98v3.1A12 12 0 0 0 12 24Z"
      />
      <Path fill="#FBBC05" d="M5.07 14.19a7.2 7.2 0 0 1 0-4.38v-3.1H.98a12 12 0 0 0 0 10.58l4.09-3.1Z" />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 .98 6.71l4.09 3.1A7.15 7.15 0 0 1 12 4.75Z"
      />
    </Svg>
  );
}

/** First screen a new (signed-out) visitor sees — Login stays phone-only
 *  for people who already have an account. Google opens a browser tab for
 *  the OAuth redirect rather than a native Credential Manager prompt — see
 *  the flowType comment in lib/supabase.ts for why. */
export function SignupScreen({
  notice,
  onUseLogin,
}: {
  notice?: AuthNotice;
  onUseLogin: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [busyEmail, setBusyEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueWithGoogle() {
    setBusyGoogle(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw error ?? new Error("Could not start Google sign-in.");

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);
      if (result.type !== "success" || !result.url) {
        // User closed the browser tab — not an error, just not finished.
        return;
      }
      const { queryParams } = Linking.parse(result.url);
      const code = queryParams?.code;
      if (typeof code !== "string") {
        throw new Error("Google sign-in didn't come back with a code.");
      }
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      // Success: the auth listener in App.tsx takes over.
    } catch (e) {
      setError(e instanceof Error ? friendlyError(e) : "Could not sign in with Google.");
    } finally {
      setBusyGoogle(false);
    }
  }

  async function sendMagicLink() {
    setBusyEmail(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: REDIRECT_URL },
    });
    setBusyEmail(false);
    if (error) setError(friendlyError(error));
    else setSent(true);
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

      <View style={styles.form}>
        {notice ? (
          <View style={[styles.sentBox, styles.noticeBox]}>
            <Text style={styles.sentText}>{AUTH_NOTICES[notice]}</Text>
          </View>
        ) : null}
        <Pressable
          onPress={continueWithGoogle}
          disabled={busyGoogle}
          style={({ pressed }) => [
            styles.googleButton,
            busyGoogle && styles.buttonDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Busy pending={busyGoogle} color={colors.ink} style={styles.googleInner}>
            <GoogleIcon />
            <Text style={styles.googleLabel}>Continue with Google</Text>
          </Busy>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {sent ? (
          <View style={styles.sentBox}>
            <Text style={styles.sentText}>
              Check your email — we sent a link to{" "}
              <Text style={{ fontWeight: "700" }}>{email}</Text>.
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.inkFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
            />
            <Pressable
              onPress={sendMagicLink}
              disabled={busyEmail || !email.trim()}
              style={({ pressed }) => [
                styles.button,
                (busyEmail || !email.trim()) && styles.buttonDisabled,
                pressed && { backgroundColor: colors.accentDeep },
              ]}
            >
              <Busy pending={busyEmail}>
                <Text style={styles.buttonLabel}>Continue with email</Text>
              </Busy>
            </Pressable>
          </>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={onUseLogin} style={styles.loginLink}>
        <Text style={styles.secondary}>Already on Raven? Log in with your phone</Text>
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
  googleInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 999,
    paddingVertical: 15,
  },
  googleLabel: { fontSize: 16, fontWeight: "700", color: colors.ink },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerLabel: { fontSize: 12, color: colors.inkFaint },
  sentBox: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 18,
    padding: 18,
  },
  sentText: { fontSize: 14, color: colors.inkSoft, textAlign: "center" },
  noticeBox: { marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.ink,
  },
  button: {
    marginTop: 2,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondary: { textAlign: "center", color: colors.inkFaint, fontSize: 14, paddingVertical: 8 },
  loginLink: { marginTop: 24 },
  error: { marginTop: 14, textAlign: "center", color: colors.late, fontSize: 14 },
});
