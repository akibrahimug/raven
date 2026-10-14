import { getSessionProfile } from "@/lib/data";
import { SettingsPanel } from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, { error }] = await Promise.all([getSessionProfile(), searchParams]);
  if (!session?.profile) return null;
  return <SettingsPanel profile={session.profile} error={error} />;
}
