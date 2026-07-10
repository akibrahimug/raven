/** The raven is a classic paper plane, sailing up and to the right.
 *  Used for the logo, the send button, the glide animation, and empty states.
 *  Inherits currentColor. */
export function RavenMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="currentColor">
      {/* upper wing */}
      <polygon points="45,4 3,25 19,31" opacity="0.9" />
      {/* body */}
      <polygon points="45,4 19,31 28,44" />
      {/* inner fold */}
      <polygon points="19,31 19,41 25,36" opacity="0.45" />
    </svg>
  );
}
