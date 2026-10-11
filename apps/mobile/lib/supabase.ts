import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // PKCE: Google sign-in opens a browser tab for the OAuth redirect
      // (see SignupScreen) rather than Supabase's native Credential Manager
      // flow — that needs a second, platform-specific Google OAuth client
      // keyed to the EAS keystore's signing fingerprint, which doesn't exist
      // until the first build runs. This reuses the single web OAuth client
      // already set up for the web app instead. PKCE is what makes
      // exchangeCodeForSession work after the browser hands control back.
      flowType: "pkce",
    },
  },
);
