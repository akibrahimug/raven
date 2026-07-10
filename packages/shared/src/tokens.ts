/**
 * "Golden hour" design tokens — the single source of truth for both web and mobile.
 * Feel: golden-hour pints in the park. Warm cream, one coral accent, sunshine touches.
 */

export const colors = {
  paper: "#FFFBF5", // app background — warm cream
  paperRaised: "#FFFFFF", // cards / sheets
  paperSunken: "#F6EEE3", // wells, input backgrounds, their chat bubbles
  ink: "#2A2119", // primary text — soft brown-black
  inkSoft: "#6E6155", // secondary text
  inkFaint: "#B4A695", // tertiary / placeholders
  line: "#F0E5D8", // hairline borders
  accent: "#FF5C39", // coral — buttons, the plane, my chat bubbles
  accentDeep: "#E8492A", // coral pressed
  accentWash: "#FFEDE6", // coral tint backgrounds
  sun: "#FFB01F", // sunshine highlight
  sunWash: "#FFF4D9",
  in: "#27965A", // "I'm in" green
  inWash: "#E4F5EA",
  late: "#A87A14", // "running late" — warm honey
  lateWash: "#FFF4D9",
  cant: "#B4A695", // declines stay muted, never red — no guilt
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 22,
  full: 999,
} as const;

export const fonts = {
  /** Headings + raven message bodies: round, characterful grotesque. */
  display: "Bricolage Grotesque",
  /** UI chrome: friendly humanist sans. */
  sans: "DM Sans",
} as const;
