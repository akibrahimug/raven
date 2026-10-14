import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { colors, type AuthNotice, type Profile } from "@raven/shared";
import { supabase } from "./lib/supabase";
import { fetchFriends, fetchProfile } from "./lib/data";
import { buzzArrival, loadPrefs } from "./lib/prefs";
import { onNotificationTap, registerPushToken } from "./lib/push";
import { Plane, displayText } from "./components/ui";
import { RavenListSkeleton } from "./components/Skeleton";
import { Avatar } from "./components/Avatar";
import { SignupScreen } from "./screens/SignupScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { PhoneScreen } from "./screens/PhoneScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { ComposeScreen } from "./screens/ComposeScreen";
import { RavenScreen } from "./screens/RavenScreen";
import { FriendsScreen } from "./screens/FriendsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

type Route =
  | { name: "inbox" }
  | { name: "past" }
  | { name: "compose" }
  | { name: "raven"; id: string }
  | { name: "friends" }
  | { name: "settings" };

/** Signed-out screens. A notice explains a hand-off between the two (see
 *  AUTH_NOTICES); `phone` carries a number typed during sign-up into login. */
type AuthScreen = { name: "signup" | "login"; notice?: AuthNotice; phone?: string };

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Whose profile `profile` is. Until it matches the signed-in user, null
  // means "still loading" rather than "hasn't picked a name" — without this,
  // every cold start flashed the onboarding screen at existing users.
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [route, setRoute] = useState<Route>({ name: "inbox" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [authScreen, setAuthScreen] = useState<AuthScreen>({ name: "signup" });

  useEffect(() => {
    loadPrefs();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setProfileFor(null);
        setRoute({ name: "inbox" });
        setAuthScreen({ name: "signup" });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // The email magic link opens raven://auth/callback from the Mail app —
  // Google's own redirect is handled entirely inside SignupScreen via
  // WebBrowser.openAuthSessionAsync and never reaches this listener.
  useEffect(() => {
    async function handleUrl(url: string) {
      const { path, queryParams } = Linking.parse(url);
      const code = queryParams?.code;
      if (path?.includes("auth/callback") && typeof code === "string") {
        await supabase.auth.exchangeCodeForSession(code);
      }
    }
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  const userId = session?.user.id ?? null;

  // Mirrors the web getSessionProfile oauthHint logic — only Google sign-ins
  // carry a name/photo worth pre-filling onboarding with.
  const oauthHint =
    session?.user.app_metadata?.provider === "google"
      ? {
          displayName: (session.user.user_metadata?.full_name ??
            session.user.user_metadata?.name ??
            null) as string | null,
          avatarUrl: (session.user.user_metadata?.avatar_url ??
            session.user.user_metadata?.picture ??
            null) as string | null,
        }
      : null;

  useEffect(() => {
    if (!userId) return;
    fetchProfile(userId)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setProfileFor(userId));
    fetchFriends(userId)
      .then((friends) => setFriendCount(friends.length))
      .catch(() => {});
  }, [userId, refreshKey]);

  // Ask for push permission only once someone is signed in with a profile —
  // never on the login screen.
  const profileId = profile?.id ?? null;
  useEffect(() => {
    if (!userId || !profileId) return;
    registerPushToken();
  }, [userId, profileId]);

  // Tapping a push (including the one that cold-started the app) opens its raven.
  useEffect(() => onNotificationTap((id) => setRoute({ name: "raven", id })), []);

  // Realtime: RLS decides what this user hears about; we just refetch.
  // raven_replies is deliberately absent here — RavenScreen patches new
  // replies into its own state directly from a subscription scoped to the
  // raven it's actually showing, so a chat message never waits on this
  // bump-and-refetch round-trip.
  useEffect(() => {
    if (!userId) return;
    const bump = () => setRefreshKey((k) => k + 1);
    const channel = supabase
      .channel("raven-mobile")
      .on("postgres_changes", { event: "*", schema: "public", table: "ravens" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "raven_recipients" }, (payload) => {
        const row = payload.new as { recipient_id?: string } | null;
        if (payload.eventType === "INSERT" && row?.recipient_id === userId) {
          buzzArrival(); // a raven just landed for this user
        }
        bump();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (session === undefined) {
    // Cold start: a plain branded frame, no spinners — keeps launch feeling instant.
    return <View style={styles.boot} />;
  }

  // Settings, or the sign-up steps before it, deleted the account. Local
  // sign-out only: the server-side session went with the account. The
  // sign-out listener resets to signup first, so the notice lands after.
  async function handleDeleted() {
    await supabase.auth.signOut({ scope: "local" });
    setAuthScreen({ name: "signup", notice: "deleted" });
  }

  let screen: React.ReactNode;
  if (!session || !userId) {
    screen =
      authScreen.name === "login" ? (
        <LoginScreen
          notice={authScreen.notice}
          initialPhone={authScreen.phone}
          onUseSignup={(notice) => setAuthScreen({ name: "signup", notice })}
        />
      ) : (
        <SignupScreen
          notice={authScreen.notice}
          onUseLogin={() => setAuthScreen({ name: "login" })}
        />
      );
  } else if (!session.user.phone_confirmed_at) {
    // Signing up is email first, then the number — a Google/email account
    // without a verified one goes no further.
    screen = (
      <PhoneScreen
        userId={userId}
        onDeleted={handleDeleted}
        onNumberTaken={async (phone) => {
          // That number already has an account: drop this half-made
          // sign-up and log in with it instead. signOut's listener resets
          // to signup first, so the login screen is set after it resolves.
          await supabase.auth.signOut();
          setAuthScreen({ name: "login", notice: "taken", phone });
        }}
      />
    );
  } else if (profileFor !== userId) {
    // The app's chrome with the inbox's outline while the profile loads.
    screen = (
      <View style={styles.flex}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Plane size={24} />
            <Text style={[displayText, styles.wordmark]}>Raven</Text>
          </View>
        </View>
        <View style={styles.loadingList}>
          <RavenListSkeleton />
        </View>
      </View>
    );
  } else if (!profile) {
    screen = (
      <OnboardingScreen
        userId={userId}
        hint={oauthHint}
        onDone={() => setRefreshKey((k) => k + 1)}
        onDeleted={handleDeleted}
      />
    );
  } else if (route.name === "compose") {
    screen = (
      <ComposeScreen
        userId={userId}
        friendCount={friendCount}
        onSent={() => {
          setRoute({ name: "inbox" });
          setRefreshKey((k) => k + 1);
        }}
        onCancel={() => setRoute({ name: "inbox" })}
      />
    );
  } else if (route.name === "raven") {
    screen = (
      <RavenScreen
        ravenId={route.id}
        userId={userId}
        refreshKey={refreshKey}
        onBack={() => setRoute({ name: "inbox" })}
      />
    );
  } else if (route.name === "friends") {
    screen = (
      <FriendsScreen
        userId={userId}
        inviteCode={profile.invite_code}
        onBack={() => setRoute({ name: "inbox" })}
      />
    );
  } else if (route.name === "settings") {
    screen = (
      <SettingsScreen
        profile={profile}
        onBack={() => setRoute({ name: "inbox" })}
        onProfileChanged={() => setRefreshKey((k) => k + 1)}
        onDeleted={handleDeleted}
      />
    );
  } else {
    const past = route.name === "past";
    screen = (
      <View style={styles.flex}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Plane size={24} />
            <Text style={[displayText, styles.wordmark]}>{past ? "Past ravens" : "Raven"}</Text>
          </View>
          <View style={styles.nav}>
            <Pressable onPress={() => setRoute(past ? { name: "inbox" } : { name: "past" })} hitSlop={8}>
              <Text style={styles.navLink}>{past ? "Now" : "Past"}</Text>
            </Pressable>
            <Pressable onPress={() => setRoute({ name: "friends" })} hitSlop={8}>
              <Text style={styles.navLink}>Friends</Text>
            </Pressable>
            <Pressable onPress={() => setRoute({ name: "settings" })} hitSlop={8}>
              <Avatar profile={profile} size={32} />
            </Pressable>
          </View>
        </View>
        <InboxScreen
          userId={userId}
          past={past}
          refreshKey={refreshKey}
          onOpen={(id) => setRoute({ name: "raven", id })}
        />
        <Pressable
          onPress={() => setRoute({ name: "compose" })}
          style={({ pressed }) => [
            styles.fab,
            { bottom: insets.bottom + 20 },
            pressed && { backgroundColor: colors.accentDeep },
          ]}
        >
          <Plane size={20} color="#fff" />
          <Text style={styles.fabLabel}>Send a Raven</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.app, { paddingTop: insets.top }]}>
      {screen}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  boot: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: { fontSize: 20 },
  nav: { flexDirection: "row", alignItems: "center", gap: 16 },
  navLink: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  fab: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 14,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  loadingList: { padding: 16 },
});
