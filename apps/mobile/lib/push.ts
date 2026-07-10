// Expo push notifications: token registration + notification-tap routing.
// Android remote push needs a dev build (Expo Go dropped it in SDK 53), and
// simulators can't receive push at all — everything here fails soft so the
// app still runs everywhere push can't.
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { colors } from "@raven/shared";
import { supabase } from "./supabase";

// Foreground arrivals are already covered by realtime + the haptic buzz, so
// keep OS banners for the background only; delivered ones still join the tray.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
});

let registered: string | null = null;

export async function registerPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Ravens",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: colors.accent,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return; // pre-`eas init` builds have no push identity yet
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.rpc("register_push_token", { t: token, p: Platform.OS });
    registered = token;
  } catch {
    // Expo Go on Android, missing FCM credentials, airplane-mode first run…
  }
}

export async function unregisterPushToken(): Promise<void> {
  const token = registered;
  registered = null;
  if (!token) return;
  try {
    await supabase.from("push_tokens").delete().eq("token", token);
  } catch {
    // best effort — a dead token also gets pruned server-side on next send
  }
}

// Fires cb for notification taps while running AND for the tap that
// cold-started the app. Returns an unsubscribe function.
export function onNotificationTap(cb: (ravenId: string) => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    const ravenId = response?.notification.request.content.data?.ravenId;
    if (typeof ravenId === "string") cb(ravenId);
  };
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  return () => sub.remove();
}
