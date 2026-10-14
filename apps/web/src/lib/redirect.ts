const HERE = "http://raven.invalid";

/** `next` rides in query strings anyone can craft, so it only ever names a
 *  page on this site. Parsed rather than prefix-checked: browsers drop tabs
 *  and newlines and read `\` as `/`, so `/<tab>/elsewhere.com` would pass a
 *  `//` check and still land on elsewhere.com. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  try {
    const url = new URL(next, HERE);
    if (url.origin !== HERE) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
