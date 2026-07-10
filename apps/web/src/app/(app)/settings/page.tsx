import { levelForPoints, nextLevel } from "@raven/shared";
import { getSessionProfile } from "@/lib/data";
import { signOut, updateProfile } from "@/lib/actions";
import { AvatarUploader } from "@/components/AvatarUploader";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, { error }] = await Promise.all([getSessionProfile(), searchParams]);
  if (!session?.profile) return null;
  const { profile } = session;
  const level = levelForPoints(profile.points);
  const next = nextLevel(profile.points);

  return (
    <div className="flex flex-col gap-10 pt-4">
      {error ? (
        <p className="rounded-xl bg-late-wash px-4 py-3 text-sm font-medium text-late-amber">
          {error}
        </p>
      ) : null}

      <section className="flex items-center gap-4 rounded-2xl border border-line bg-raised p-5">
        <AvatarUploader profile={profile} />
        <div>
          <p className="invitation text-xl">{profile.display_name}</p>
          <p className="text-sm font-semibold" style={{ color: level.color }}>
            {level.name} · {profile.points} pts
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {next
              ? `${next.min - profile.points} pts to ${next.name} — accept ravens to climb.`
              : "Top of the ladder. The sky is yours."}
          </p>
        </div>
      </section>

      <section>
        <h2 className="invitation text-xl">Your photo</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          Tap your picture above to change it. The ring colour comes from your level.
        </p>
      </section>

      <section>
        <h2 className="invitation text-xl">Your name</h2>
        <form action={updateProfile} className="mt-3 flex items-center gap-2">
          <input
            name="display_name"
            defaultValue={profile.display_name}
            maxLength={40}
            required
            className="min-w-0 flex-1 rounded-xl border border-line bg-raised px-4 py-2.5 text-sm focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper"
          >
            Save
          </button>
        </form>
      </section>

      <form action={signOut} className="pb-4">
        <button type="submit" className="text-sm text-ink-faint underline-offset-2 hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
