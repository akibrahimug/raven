import { CopyInviteButton } from "@/components/CopyInviteButton";
import { Bone, LoadingRegion, Slab } from "@/components/Skeleton";

/** The invite section of /friends. Without `invite` it's its own loading
 *  state: the copy stays put, the link and button wait as placeholders. */
export function InviteCard({ invite }: { invite?: { url: string; senderName: string } }) {
  return (
    <section className="rounded-2xl border border-line bg-raised p-5">
      <h2 className="invitation text-xl">Your invite link</h2>
      <p className="mt-1.5 text-sm text-ink-soft">
        Anyone who opens it asks to be your friend, and you say yes or no. Every raven
        you send flies to all your friends — so only say yes to people you&apos;d actually
        want turning up.
      </p>
      {invite ? (
        <>
          <p className="mt-3 truncate rounded-lg bg-sunken px-3 py-2 font-mono text-xs text-ink-soft">
            {invite.url}
          </p>
          <div className="mt-4">
            <CopyInviteButton url={invite.url} senderName={invite.senderName} />
          </div>
        </>
      ) : (
        <LoadingRegion label="Loading your invite link">
          <Slab className="mt-3 h-8 rounded-lg" />
          <Bone className="mt-4 h-10 w-40" />
        </LoadingRegion>
      )}
    </section>
  );
}
