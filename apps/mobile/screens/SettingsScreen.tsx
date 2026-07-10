import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, friendlyError, levelForPoints, nextLevel, type Profile } from "@raven/shared";
import { supabase } from "../lib/supabase";
import { uploadPhotoBase64 } from "../lib/media";
import { getHapticsEnabled, setHapticsEnabled } from "../lib/prefs";
import { unregisterPushToken } from "../lib/push";
import { Avatar } from "../components/Avatar";
import { displayText } from "../components/ui";

export function SettingsScreen({
  profile,
  onBack,
  onProfileChanged,
}: {
  profile: Profile;
  onBack: () => void;
  onProfileChanged: () => void;
}) {
  const [name, setName] = useState(profile.display_name);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [haptics, setHaptics] = useState(getHapticsEnabled());
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const level = levelForPoints(profile.points);
  const next = nextLevel(profile.points);

  async function changePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadPhotoBase64(profile.id, result.assets[0].base64);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", profile.id);
      if (error) throw new Error(friendlyError(error));
      setAvatarUrl(url);
      onProfileChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  }

  async function saveName() {
    if (!name.trim()) return;
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", profile.id);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onProfileChanged();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <View style={styles.card}>
        <Pressable onPress={changePhoto} disabled={uploading} style={styles.avatarButton}>
          <Avatar profile={{ display_name: profile.display_name, avatar_url: avatarUrl, points: profile.points }} size={64} />
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarBadgeLabel}>{uploading ? "…" : "Edit"}</Text>
          </View>
        </Pressable>
        <View style={styles.cardText}>
          <Text style={[displayText, styles.name]}>{profile.display_name}</Text>
          <Text style={[styles.level, { color: level.color }]}>
            {level.name} · {profile.points} pts
          </Text>
          <Text style={styles.nextLevel}>
            {next
              ? `${next.min - profile.points} pts to ${next.name} — accept ravens to climb.`
              : "Top of the ladder. The sky is yours."}
          </Text>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={[displayText, styles.sectionTitle]}>Your name</Text>
      <View style={styles.nameRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={40}
          style={styles.nameInput}
          placeholderTextColor={colors.inkFaint}
        />
        <Pressable onPress={saveName} style={styles.saveButton}>
          <Text style={styles.saveLabel}>{saved ? "Saved" : "Save"}</Text>
        </Pressable>
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleTitle}>Vibrate when a raven arrives</Text>
          <Text style={styles.hint}>A little flutter, so you never miss one.</Text>
        </View>
        <Switch
          value={haptics}
          onValueChange={(value) => {
            setHaptics(value);
            setHapticsEnabled(value);
          }}
          trackColor={{ true: colors.accent, false: colors.line }}
        />
      </View>

      <Pressable
        onPress={async () => {
          await unregisterPushToken(); // this device stops buzzing for this account
          supabase.auth.signOut();
        }}
        style={styles.signOut}
      >
        <Text style={styles.signOutLabel}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  scroll: { padding: 20, gap: 12, paddingBottom: 60 },
  back: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.paperRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 18,
    marginTop: 8,
  },
  avatarButton: { position: "relative" },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  avatarBadgeLabel: { color: colors.paper, fontSize: 9, fontWeight: "700" },
  cardText: { flex: 1, gap: 2 },
  name: { fontSize: 20 },
  level: { fontSize: 14, fontWeight: "700" },
  nextLevel: { fontSize: 12, color: colors.inkFaint },
  error: { fontSize: 12, color: colors.late },
  sectionTitle: { fontSize: 20, marginTop: 14 },
  hint: { fontSize: 13, color: colors.inkSoft },
  nameRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
  },
  saveButton: {
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  saveLabel: { color: colors.paper, fontSize: 14, fontWeight: "600" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    backgroundColor: colors.paperRaised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 16,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  signOut: { marginTop: 22, alignSelf: "flex-start" },
  signOutLabel: { fontSize: 13, color: colors.inkFaint, textDecorationLine: "underline" },
});
