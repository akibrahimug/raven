// Carries the number typed on the sign-up phone step over to /login when it
// turns out to belong to an existing account, so it needn't be typed twice.
// sessionStorage rather than the URL keeps the number out of request logs;
// losing it (private window, blocked storage) only means typing it again.
const KEY = "raven:phone";

export function stashPhone(phone: string) {
  try {
    sessionStorage.setItem(KEY, phone);
  } catch {
    // Storage unavailable — the login form just starts empty.
  }
}

export function takeStashedPhone(): string | null {
  try {
    const phone = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return phone;
  } catch {
    return null;
  }
}
