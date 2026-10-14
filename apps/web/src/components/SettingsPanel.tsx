import { levelForPoints, nextLevel, type Profile } from "@raven/shared";
import { signOut, updateProfile } from "@/lib/actions";
import { AvatarUploader } from "@/components/AvatarUploader";
import { Bone, LoadingRegion, Slab } from "@/components/Skeleton";

/** Everything on /settings. Without `profile` it's the page's loading state:
 *  the same sections, with placeholders where your details go. */
export function SettingsPanel({ profile, error }: { profile?: Profile; error?: string }) {
  return (
    <div className="flex flex-col gap-10 pt-4">
      {error ? (
        <p className="rounded-xl bg-late-wash px-4 py-3 text-sm font-medium text-late-amber">
          {error}
        </p>
      ) : null}

      {profile ? <ProfileCard profile={profile} /> : <ProfileCardSkeleton />}

      <section>
        <h2 className="invitation text-xl">Your photo</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          Tap your picture above to change it. The ring colour comes from your level.
        </p>
      </section>

      <section>
        <h2 className="invitation text-xl">Your name</h2>
        {profile ? (
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
        ) : (
          <LoadingRegion label="Loading your name" className="mt-3 flex items-center gap-2">
            <Slab className="h-10 flex-1 rounded-xl" />
            <Bone className="h-10 w-16" />
          </LoadingRegion>
        )}
      </section>

      <form action={signOut} className="pb-4">
        <button type="submit" className="text-sm text-ink-faint underline-offset-2 hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const level = levelForPoints(profile.points);
  const next = nextLevel(profile.points);
  return (
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
  );
}

function ProfileCardSkeleton() {
  return (
    <LoadingRegion
      label="Loading your profile"
      className="flex items-center gap-4 rounded-2xl border border-line bg-raised p-5"
    >
      <Bone className="size-16" />
      <div className="flex-1">
        <Bone className="h-6 w-32" />
        <Bone className="mt-2 h-3.5 w-40" />
        <Bone className="mt-2 h-3 w-48" />
      </div>
    </LoadingRegion>
  );
}
