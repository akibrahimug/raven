import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, locationMapsUrl, timeAgo, timeLeft, type Profile, type RsvpStatus } from "@raven/shared";
import * as ImagePicker from "expo-image-picker";
import { fetchRaven, rsvp, sendReply, type RavenDetail, type ReplyRow } from "../lib/data";
import { supabase } from "../lib/supabase";
import { uploadPhotoBase64 } from "../lib/media";
import { buzzTap } from "../lib/prefs";
import { Avatar } from "../components/Avatar";
import { displayText, LocationPin } from "../components/ui";
import { Bone, Pulse } from "../components/Skeleton";

const RSVP_PILLS: Array<{ status: Exclude<RsvpStatus, "pending">; label: string; color: string }> = [
  { status: "in", label: "I'm in", color: colors.in },
  { status: "late", label: "Running late", color: colors.late },
  { status: "cant", label: "Can't", color: colors.inkFaint },
];

const SHEET_ANIM_MS = 280;

export function RavenScreen({
  ravenId,
  userId,
  refreshKey,
  onBack,
}: {
  ravenId: string;
  userId: string;
  refreshKey: number;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // undefined while loading; null once we know it's gone (recalled, or not yours).
  const [raven, setRaven] = useState<RavenDetail | null | undefined>(undefined);
  const [reply, setReply] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ids already rendered (including optimistic "pending-…" ones), so the
  // realtime echo of the viewer's own insert never produces a second bubble.
  const knownReplyIds = useRef<Set<string>>(new Set());
  // Every profile who could plausibly author a reply here (sender +
  // recipients) — a realtime payload carries only raw columns, no joined
  // author row, so this is how an incoming message gets a display name
  // without a second network call.
  const participantsRef = useRef<Record<string, Profile | null>>({});

  // The who's-in list owns the screen by default. The chat only takes over
  // when its input is activated, sliding up like a sheet over everything else.
  const [chatOpen, setChatOpen] = useState(false);
  const chatAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const threadScrollRef = useRef<ScrollView>(null);

  // The sheet is absolutely positioned, so KeyboardAvoidingView's padding
  // can't reach it — track the keyboard directly and lift the sheet ourselves.
  // Android resizes the window itself (softwareKeyboardLayoutMode: resize),
  // so only iOS needs this.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", (event) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardWillHide", () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const COLLAPSED_HEIGHT = 78 + (keyboardHeight > 0 ? 0 : insets.bottom);
  const EXPANDED_HEIGHT = Math.max(
    240,
    Math.min(windowHeight * 0.92, windowHeight - insets.top - 64 - keyboardHeight),
  );

  function openChat() {
    if (chatOpen) return;
    setChatOpen(true);
    Animated.timing(chatAnim, {
      toValue: 1,
      duration: SHEET_ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }

  function closeChat() {
    Keyboard.dismiss();
    Animated.timing(chatAnim, {
      toValue: 0,
      duration: SHEET_ANIM_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(() => setChatOpen(false));
  }

  const load = useCallback(async () => {
    try {
      const detail = await fetchRaven(ravenId);
      setRaven(detail);
      if (detail) {
        knownReplyIds.current = new Set(detail.replies.map((r) => r.id));
        const participants: Record<string, Profile | null> = { [detail.sender_id]: detail.sender };
        for (const r of detail.recipients) {
          if (r.profile) participants[r.profile.id] = r.profile;
        }
        participantsRef.current = participants;
      }
    } catch {
      // transient — realtime or the next action retries
    }
  }, [ravenId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Chat replies patch themselves in directly — scoped to this one raven —
  // rather than waiting on the app-level bump+refetch cycle in App.tsx,
  // which no longer listens for raven_replies at all.
  useEffect(() => {
    const channel = supabase
      .channel(`raven-replies-${ravenId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "raven_replies", filter: `raven_id=eq.${ravenId}` },
        (payload) => {
          const row = payload.new as Omit<ReplyRow, "author">;
          if (knownReplyIds.current.has(row.id)) return;
          knownReplyIds.current.add(row.id);
          const author = participantsRef.current[row.author_id] ?? null;
          setRaven((prev) => (prev ? { ...prev, replies: [...prev.replies, { ...row, author }] } : prev));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ravenId]);

  if (raven === undefined) {
    // Mirrors the layout below: sender line, the message, the RSVP row, who's in.
    return (
      <View style={styles.container}>
        <View style={styles.scroll}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <Pulse style={styles.skeleton}>
            <View style={styles.senderRow}>
              <Bone style={{ width: 30, height: 30 }} />
              <Bone style={{ width: 150, height: 10 }} />
            </View>
            <Bone style={{ width: "92%", height: 24 }} />
            <Bone style={{ width: "62%", height: 24 }} />
            <View style={styles.rsvpRow}>
              <Bone style={{ width: 66, height: 31 }} />
              <Bone style={{ width: 104, height: 31 }} />
              <Bone style={{ width: 58, height: 31 }} />
            </View>
            <Bone style={{ width: "100%", height: 96, borderRadius: 16 }} />
          </Pulse>
        </View>
      </View>
    );
  }

  if (raven === null) {
    return (
      <View style={styles.container}>
        <View style={styles.scroll}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <Text style={[displayText, styles.goneTitle]}>This raven has flown.</Text>
          <Text style={styles.goneHint}>It was recalled, or it&apos;s moved on.</Text>
        </View>
      </View>
    );
  }

  const isSender = raven.sender_id === userId;
  const me = raven.recipients.find((r) => r.recipient_id === userId) ?? null;
  const attending = raven.recipients.filter((r) => r.status === "in" || r.status === "late");
  const awaiting = raven.recipients.filter((r) => r.status === "pending");
  const declined = raven.recipients.filter((r) => r.status === "cant");
  const inThread = isSender || me?.status === "in" || me?.status === "late";
  const expired = new Date(raven.expires_at) <= new Date();
  const replies = raven.replies
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  async function respond(next: Exclude<RsvpStatus, "pending">) {
    buzzTap();
    try {
      await rsvp(ravenId, userId, next);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not respond.");
    }
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  }

  async function submitReply() {
    const trimmed = reply.trim();
    if (!trimmed && !photoBase64) return;
    buzzTap();

    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // The locally-picked file's own uri doubles as the optimistic bubble's
    // image — no need to wait for the real upload to show *something*.
    const optimistic: ReplyRow = {
      id: tempId,
      raven_id: ravenId,
      author_id: userId,
      body: trimmed,
      media_url: photoUri,
      created_at: new Date().toISOString(),
      author: null, // "mine" bubbles never render the author label anyway
    };
    knownReplyIds.current.add(tempId);
    setRaven((prev) => (prev ? { ...prev, replies: [...prev.replies, optimistic] } : prev));

    // Clear immediately — the bubble already shows the content, so holding
    // the input hostage until the network call resolves would be exactly
    // the "did my click do anything" regression the rest of the app fixed.
    setReply("");
    setPhotoBase64(null);
    setPhotoUri(null);
    setError(null);

    try {
      const mediaUrl = photoBase64 ? await uploadPhotoBase64(userId, photoBase64) : null;
      const real = await sendReply(ravenId, userId, trimmed, mediaUrl);
      knownReplyIds.current.delete(tempId);
      knownReplyIds.current.add(real.id);
      setRaven((prev) =>
        prev ? { ...prev, replies: prev.replies.map((r) => (r.id === tempId ? real : r)) } : prev,
      );
    } catch (e) {
      knownReplyIds.current.delete(tempId);
      setRaven((prev) =>
        prev ? { ...prev, replies: prev.replies.filter((r) => r.id !== tempId) } : prev,
      );
      setError(e instanceof Error ? e.message : "Could not send.");
      setReply(trimmed);
    }
  }

  const sheetHeight = chatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_HEIGHT, EXPANDED_HEIGHT],
  });
  const dimOpacity = chatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.32] });
  const handleOpacity = chatAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: COLLAPSED_HEIGHT + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>

        <View style={styles.senderRow}>
          <Avatar profile={raven.sender} size={30} />
          <Text style={styles.eyebrow}>
            {(isSender ? "YOU" : raven.sender.display_name.toUpperCase()) +
              `   ${timeAgo(raven.created_at)} · ${timeLeft(raven.expires_at)}`}
          </Text>
        </View>
        <Text style={[displayText, styles.body]}>{raven.body}</Text>
        {raven.location ? (
          <Pressable
            onPress={() => Linking.openURL(locationMapsUrl(raven.location!))}
            hitSlop={6}
            style={styles.locationRow}
          >
            <LocationPin size={15} color={colors.inkSoft} />
            <Text style={styles.locationText}>{raven.location}</Text>
          </Pressable>
        ) : null}
        {raven.media_url ? (
          <Image source={{ uri: raven.media_url }} style={styles.hero} resizeMode="cover" />
        ) : null}

        {me && !expired ? (
          <View style={styles.rsvpRow}>
            {RSVP_PILLS.map((pill) => {
              const active = me.status === pill.status;
              return (
                <Pressable
                  key={pill.status}
                  onPress={() => respond(pill.status)}
                  style={[
                    styles.rsvpPill,
                    active && { borderColor: pill.color, backgroundColor: `${pill.color}1A` },
                  ]}
                >
                  <Text style={[styles.rsvpLabel, active && { color: pill.color }]}>
                    {pill.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {attending.length > 0 ? (
          <View style={styles.attendeeCard}>
            {attending.map((r, index) => {
              const isYou = r.recipient_id === userId;
              const late = r.status === "late";
              const name = isYou ? "You" : (r.profile?.display_name ?? "Someone");
              return (
                <View
                  key={r.recipient_id}
                  style={[styles.attendeeRow, index > 0 && styles.attendeeRowBorder]}
                >
                  <Avatar
                    profile={r.profile ?? { display_name: name, avatar_url: null, points: 0 }}
                    size={28}
                  />
                  <Text style={styles.attendeeName}>{name}</Text>
                  <View style={[styles.attendeeChip, late ? styles.lateChip : styles.inChip]}>
                    <Text style={[styles.attendeeChipLabel, { color: late ? colors.late : colors.in }]}>
                      {late ? "Running late" : "In"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
        {isSender && (awaiting.length > 0 || declined.length > 0) ? (
          <Text style={styles.muted}>
            {[
              awaiting.length > 0 ? `${awaiting.length} haven't replied` : null,
              declined.length > 0 ? `${declined.length} can't make it` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        ) : null}
        {!inThread && me && !expired ? (
          <Text style={styles.muted}>Say you&apos;re in to join the chat.</Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {inThread ? (
        <>
          <Animated.View
            pointerEvents={chatOpen ? "auto" : "none"}
            style={[styles.dim, { opacity: dimOpacity }]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeChat} />
          </Animated.View>

          <Animated.View style={[styles.sheet, { height: sheetHeight, bottom: keyboardHeight }]}>
            <Animated.View style={[styles.handleWrap, { opacity: handleOpacity }]}>
              <Pressable onPress={closeChat} hitSlop={10} style={styles.handleTap}>
                <View style={styles.handleBar} />
              </Pressable>
            </Animated.View>

            <Animated.ScrollView
              ref={threadScrollRef}
              style={[styles.threadScroll, { opacity: chatAnim }]}
              contentContainerStyle={styles.threadContent}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => threadScrollRef.current?.scrollToEnd({ animated: false })}
            >
              {replies.length === 0 ? (
                <Text style={styles.muted}>No replies yet — say hello.</Text>
              ) : (
                replies.map((item) => {
                  const mine = item.author_id === userId;
                  return (
                    <View
                      key={item.id}
                      style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.theirsWrap]}
                    >
                      {!mine ? (
                        <Text style={styles.bubbleAuthor}>{item.author?.display_name ?? "Someone"}</Text>
                      ) : null}
                      {item.media_url ? (
                        <Image source={{ uri: item.media_url }} style={styles.bubbleMedia} resizeMode="cover" />
                      ) : null}
                      {item.body ? (
                        <View style={[styles.bubble, mine ? styles.mineBubble : styles.theirsBubble]}>
                          <Text style={mine ? styles.mineText : styles.theirsText}>{item.body}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </Animated.ScrollView>

            {expired ? (
              <Pressable onPress={chatOpen ? closeChat : openChat} style={styles.closedBar}>
                <Text style={styles.closedBarLabel}>This raven has flown — the chat is closed.</Text>
              </Pressable>
            ) : (
              <View
                style={[
                  styles.replyBar,
                  { paddingBottom: 10 + (keyboardHeight > 0 ? 0 : insets.bottom) },
                ]}
              >
                {photoUri ? (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: photoUri }} style={styles.preview} />
                    <Pressable
                      onPress={() => {
                        setPhotoUri(null);
                        setPhotoBase64(null);
                      }}
                      style={styles.removePhoto}
                    >
                      <Text style={styles.removePhotoLabel}>✕</Text>
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.replyRow}>
                  <Pressable onPress={pickPhoto} style={styles.photoButton} hitSlop={8}>
                    <Text style={styles.photoButtonLabel}>＋</Text>
                  </Pressable>
                  <TextInput
                    ref={inputRef}
                    value={reply}
                    onChangeText={setReply}
                    onFocus={openChat}
                    placeholder="Reply…"
                    placeholderTextColor={colors.inkFaint}
                    maxLength={500}
                    style={styles.replyInput}
                  />
                  <Pressable
                    onPress={submitReply}
                    disabled={!reply.trim() && !photoBase64}
                    style={[styles.sendButton, !reply.trim() && !photoBase64 && { opacity: 0.4 }]}
                  >
                    <Text style={styles.sendLabel}>Send</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  skeleton: { gap: 12 },
  goneTitle: { fontSize: 24, color: colors.inkSoft, marginTop: 24 },
  goneHint: { fontSize: 14, color: colors.inkFaint },
  scroll: { padding: 20, gap: 12 },
  back: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, color: colors.inkSoft },
  body: { fontSize: 26, lineHeight: 32 },
  hero: { width: "100%", height: 220, borderRadius: 18 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" },
  locationText: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  rsvpRow: { flexDirection: "row", gap: 8 },
  rsvpPill: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  rsvpLabel: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  attendeeCard: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.paperRaised,
    overflow: "hidden",
  },
  attendeeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  attendeeRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  attendeeName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  attendeeChip: { marginLeft: "auto", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  inChip: { backgroundColor: colors.inWash },
  lateChip: { backgroundColor: colors.lateWash },
  attendeeChipLabel: { fontSize: 12, fontWeight: "700" },
  muted: { fontSize: 13, color: colors.inkFaint },
  error: { fontSize: 13, color: colors.late },

  dim: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.ink,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 14,
  },
  handleWrap: { alignItems: "center", paddingTop: 8, paddingBottom: 2 },
  handleTap: { padding: 8 },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line },
  threadScroll: { flex: 1 },
  threadContent: { padding: 16, gap: 8, flexGrow: 1, justifyContent: "flex-end" },
  bubbleWrap: { maxWidth: "80%", gap: 4 },
  mineWrap: { alignSelf: "flex-end", alignItems: "flex-end" },
  theirsWrap: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubbleAuthor: { fontSize: 11, fontWeight: "600", color: colors.inkFaint, marginLeft: 12, marginBottom: 2 },
  bubble: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  mineBubble: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  theirsBubble: { backgroundColor: colors.paperSunken, borderBottomLeftRadius: 6 },
  mineText: { color: "#fff", fontSize: 15, lineHeight: 20 },
  theirsText: { color: colors.ink, fontSize: 15, lineHeight: 20 },
  bubbleMedia: {
    width: 200,
    height: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  closedBar: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  closedBarLabel: { fontSize: 13, color: colors.inkFaint, textAlign: "center" },
  replyBar: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
    padding: 12,
    gap: 8,
  },
  previewWrap: { alignSelf: "flex-start" },
  preview: { width: 72, height: 72, borderRadius: 10 },
  removePhoto: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: colors.ink,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoLabel: { color: colors.paper, fontSize: 11, fontWeight: "700" },
  replyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  photoButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  photoButtonLabel: { fontSize: 18, color: colors.inkSoft, lineHeight: 20 },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.ink,
  },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
