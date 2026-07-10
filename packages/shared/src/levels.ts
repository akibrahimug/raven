/** The social ladder. Accepting a raven (I'm in / running late) earns 10
 *  points; bailing gives them back. Your level colours how friends see you.
 *  Themed on the messenger, not the bird — the raven's an ancient way to get
 *  word to someone; the levels track how reliably you show up when called. */

export interface Level {
  name: string;
  min: number;
  color: string;
}

export const LEVELS: Level[] = [
  { name: "New Messenger", min: 0, color: "#B4A695" }, // everyone starts here
  { name: "Regular", min: 30, color: "#27965A" }, // 3 accepted ravens
  { name: "Reliable", min: 80, color: "#FFB01F" },
  { name: "Trusted", min: 160, color: "#FF5C39" },
  { name: "Inner Circle", min: 300, color: "#2A2119" },
  { name: "Legend", min: 500, color: "#6C4CF1" },
];

export function levelForPoints(points: number): Level {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.min) current = level;
  }
  return current;
}

/** The next level up, or null at the top. */
export function nextLevel(points: number): Level | null {
  return LEVELS.find((level) => level.min > points) ?? null;
}
