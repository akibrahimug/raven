import { initials, levelForPoints, type Profile } from "@raven/shared";

const SIZES = {
  sm: { box: "size-7", text: "text-[11px]", ring: "border-2" },
  md: { box: "size-9", text: "text-xs", ring: "border-2" },
  lg: { box: "size-16", text: "text-xl", ring: "border-[3px]" },
} as const;

/** A friend's face: their photo if they've set one, otherwise their initials.
 *  Ringed in their level colour. */
export function Avatar({
  profile,
  size = "md",
}: {
  profile: Pick<Profile, "display_name" | "avatar_url" | "points">;
  size?: keyof typeof SIZES;
}) {
  const level = levelForPoints(profile.points);
  const { box, text, ring } = SIZES[size];
  return (
    <span
      className={`grid ${box} shrink-0 place-items-center overflow-hidden rounded-full ${ring} bg-sunken font-semibold text-ink-soft ${text}`}
      style={{ borderColor: level.color }}
    >
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        initials(profile.display_name)
      )}
    </span>
  );
}
