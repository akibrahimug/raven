import { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  colors,
  CUSTOM_EXPIRY_HOURS_MAX,
  CUSTOM_EXPIRY_HOURS_MIN,
  DEFAULT_EXPIRY_PRESET,
  EXPIRY_PRESETS,
  expiryFromCustomHours,
  expiryFromPreset,
  type ExpiryPreset,
} from "@raven/shared";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sendRaven } from "../lib/data";
import { uploadPhotoBase64 } from "../lib/media";
import { buzzTap } from "../lib/prefs";
import { LocationPin, Plane, Pill, displayText } from "../components/ui";

const FLIGHT_MS = 1000;
const DEFAULT_CUSTOM_HOURS = "6";
type ExpiryChoice = ExpiryPreset | "custom";

export function ComposeScreen({
  userId,
  friendCount,
  onSent,
  onCancel,
}: {
  userId: string;
  friendCount: number;
  onSent: () => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");
  const [preset, setPreset] = useState<ExpiryChoice>(DEFAULT_EXPIRY_PRESET);
  const [customHours, setCustomHours] = useState(DEFAULT_CUSTOM_HOURS);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [addingLocation, setAddingLocation] = useState(false);
  const [location, setLocation] = useState("");
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flying, setFlying] = useState(false);
  const flight = useRef(new Animated.Value(0)).current;

  const customHoursNum = Number(customHours);
  const customHoursValid =
    preset !== "custom" || (customHoursNum >= CUSTOM_EXPIRY_HOURS_MIN && customHoursNum <= CUSTOM_EXPIRY_HOURS_MAX);
  const ready = body.trim().length > 0 && friendCount > 0 && customHoursValid && !busy;
  const window = Dimensions.get("window");

  function expiresAt(): Date {
    return preset === "custom" ? expiryFromCustomHours(customHoursNum) : expiryFromPreset(preset);
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

  async function submit() {
    if (!ready) return;
    buzzTap();
    setBusy(true);
    setError(null);
    setFlying(true);
    Animated.timing(flight, {
      toValue: 1,
      duration: FLIGHT_MS,
      easing: Easing.bezier(0.45, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
    const flightDone = new Promise((resolve) => setTimeout(resolve, FLIGHT_MS + 50));
    try {
      let mediaUrl: string | null = null;
      if (photoBase64) {
        mediaUrl = await uploadPhotoBase64(userId, photoBase64);
      }
      await sendRaven(userId, body, expiresAt().toISOString(), mediaUrl, location.trim() || null);
      await flightDone;
      onSent();
    } catch (e) {
      flight.setValue(0);
      setFlying(false);
      setError(e instanceof Error ? e.message : "Could not send.");
      setBusy(false);
    }
  }

  // The button shrinks away as the plane lifts out of it.
  const buttonScale = flight.interpolate({ inputRange: [0, 0.18, 1], outputRange: [1, 0.6, 0.6] });
  const buttonOpacity = flight.interpolate({ inputRange: [0, 0.18, 1], outputRange: [1, 0, 0] });
  const planeX = flight.interpolate({ inputRange: [0, 1], outputRange: [0, window.width * 0.55] });
  const planeY = flight.interpolate({ inputRange: [0, 1], outputRange: [0, -window.height * 0.6] });
  const planeRotate = flight.interpolate({ inputRange: [0, 1], outputRange: ["12deg", "-14deg"] });
  const planeOpacity = flight.interpolate({
    inputRange: [0, 0.1, 0.82, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[displayText, styles.title]}>New raven</Text>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>

        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="What's happening?"
          placeholderTextColor={colors.inkFaint}
          multiline
          maxLength={280}
          autoFocus
          style={styles.input}
        />

        {photoUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
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
        ) : (
          <Pill label="＋ Add a photo" onPress={pickPhoto} style={styles.photoButton} />
        )}

        {addingLocation ? (
          <View style={styles.locationInputRow}>
            <LocationPin size={16} color={colors.inkSoft} />
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Where?"
              placeholderTextColor={colors.inkFaint}
              maxLength={140}
              autoFocus
              style={styles.locationInput}
            />
            <Pressable
              onPress={() => {
                setAddingLocation(false);
                setLocation("");
              }}
              hitSlop={8}
            >
              <Text style={styles.removePhotoLabel}>✕</Text>
            </Pressable>
          </View>
        ) : (
          <Pill label="Add a location" onPress={() => setAddingLocation(true)} style={styles.photoButton} />
        )}

        <Text style={styles.sectionLabel}>I&apos;M AROUND FOR</Text>
        <View style={styles.presetRow}>
          {EXPIRY_PRESETS.map((option) => (
            <Pill
              key={option.key}
              label={option.label}
              active={preset === option.key}
              onPress={() => setPreset(option.key)}
            />
          ))}
          <Pill label="Custom" active={preset === "custom"} onPress={() => setPreset("custom")} />
        </View>
        {preset === "custom" ? (
          <View style={styles.customRow}>
            <TextInput
              value={customHours}
              onChangeText={setCustomHours}
              keyboardType="decimal-pad"
              style={[styles.customInput, !customHoursValid && styles.customInputInvalid]}
            />
            <Text style={styles.hint}>hours</Text>
            {!customHoursValid ? (
              <Text style={styles.customError}>
                Between {CUSTOM_EXPIRY_HOURS_MIN} and {CUSTOM_EXPIRY_HOURS_MAX}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.hint}>When you&apos;re gone, the raven fades for everyone.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Animated.View style={{ transform: [{ scale: buttonScale }], opacity: buttonOpacity }}>
          <Pressable
            onPress={submit}
            disabled={!ready}
            style={({ pressed }) => [
              styles.send,
              !ready && !flying && { opacity: 0.4 },
              pressed && { backgroundColor: colors.accentDeep },
            ]}
          >
            <Plane size={20} color="#fff" />
            <Text style={styles.sendLabel}>Send the Raven</Text>
          </Pressable>
        </Animated.View>
        <Text style={styles.footnote}>
          {friendCount === 0
            ? "No friends yet — share your invite link first."
            : `Flies to all ${friendCount} of your friends. They decide.`}
        </Text>
      </ScrollView>

      {flying ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              styles.flightPlane,
              {
                opacity: planeOpacity,
                transform: [
                  { translateX: planeX },
                  { translateY: planeY },
                  { rotate: planeRotate },
                ],
              },
            ]}
          >
            <Plane size={72} />
          </Animated.View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  scroll: { padding: 20, gap: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { fontSize: 24 },
  cancel: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 18,
    padding: 18,
    minHeight: 110,
    fontSize: 21,
    fontWeight: "600",
    color: colors.ink,
    textAlignVertical: "top",
  },
  photoButton: { alignSelf: "flex-start" },
  locationInputRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 8,
  },
  locationInput: { minWidth: 120, fontSize: 14, color: colors.ink },
  previewWrap: { alignSelf: "flex-start" },
  preview: { width: 160, height: 160, borderRadius: 16 },
  removePhoto: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: colors.ink,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoLabel: { color: colors.paper, fontSize: 12, fontWeight: "700" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: colors.inkSoft,
    marginTop: 6,
  },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  customRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  customInput: {
    width: 64,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: colors.ink,
  },
  customInputInvalid: { borderColor: colors.late },
  customError: { fontSize: 11, color: colors.late },
  hint: { fontSize: 12, color: colors.inkFaint },
  error: { color: colors.late, fontSize: 14 },
  send: {
    marginTop: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 26,
    paddingVertical: 15,
  },
  sendLabel: { color: "#fff", fontSize: 16, fontWeight: "700" },
  footnote: { textAlign: "center", fontSize: 12, color: colors.inkFaint },
  flightPlane: { position: "absolute", bottom: 170, alignSelf: "center" },
});
