import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

const HAPTICS_KEY = "raven:haptics";
let hapticsEnabled = true; // default on — a raven should land with a flutter

export async function loadPrefs(): Promise<void> {
  const stored = await AsyncStorage.getItem(HAPTICS_KEY);
  hapticsEnabled = stored !== "off";
}

export function getHapticsEnabled(): boolean {
  return hapticsEnabled;
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  hapticsEnabled = enabled;
  await AsyncStorage.setItem(HAPTICS_KEY, enabled ? "on" : "off");
}

/** A raven just landed. */
export function buzzArrival(): void {
  if (!hapticsEnabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Light tick for taps (RSVP, send). Always subtle, gated by the same toggle. */
export function buzzTap(): void {
  if (!hapticsEnabled) return;
  Haptics.selectionAsync().catch(() => {});
}
