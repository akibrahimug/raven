# Raven

Send a Raven: a one-line "I'm doing this anyway — come if you fancy it" that flies
to all your friends at once. Not an event, not a group chat, not a social network.
No picking recipients — everyone you've added gets it, and they decide. Every raven
expires when you're no longer around; recipients answer with one tap; declines stay
private. Photos ride along on ravens and in the bubble-chat thread.

## Monorepo layout

```
apps/web        Next.js app (full product)
apps/mobile     Expo app (full product, ported from web)
packages/shared Types, expiry logic, "golden hour" design tokens, reward levels
supabase/       Migrations (schema + RLS = the whole social model) and local config
scripts/        smoke.mjs (RLS/privacy/rewards test suite), seed-dev.mjs (populates local data)
```

Raven is not bird-themed. The name refers to the ancient idea of sending word by messenger — done
the modern way. No bird mascots or emoji; the only bird-adjacent thing in the product is the paper
plane that flies when you send.

## Prerequisites

- **Node 22** (`nvm use` — picks it up from `.nvmrc`; supabase-js needs Node 22's native WebSocket)
- **pnpm 10**
- **Docker** (Colima works — analytics is disabled in `supabase/config.toml` because
  Colima can't mount the Docker socket)
- **Supabase CLI** (`brew install supabase/tap/supabase`)

## Run it locally

```sh
supabase start        # local Postgres + auth + realtime; applies migrations
pnpm install
pnpm web              # Next.js on http://localhost:3000
```

### Mobile (Expo Go)

```sh
pnpm mobile           # starts Metro; scan the QR with Expo Go on your phone
```

The app is deliberately lean — no navigation library, no UI kit, system fonts,
one small Hermes bundle (~2.4 MB) — so it launches like a native app. Your phone
must be on the same Wi-Fi as this machine; `apps/mobile/.env` points at the
Mac's LAN IP for local Supabase (update it if your IP changes:
`ipconfig getifaddr en0`).

A raven landing in your inbox triggers a haptic buzz by default (toggle it off
in Settings). Sending one morphs the send button into a paper plane that flies
off screen, via React Native's built-in `Animated` API — no extra dependency.

Signing up is **email first, then a phone number** verified by SMS code;
logging back in is the number alone, and a number with no account is sent to
sign up. Locally, sign up with any email — the link lands in the local inbox
at http://127.0.0.1:54324 (Google isn't configured locally) — then add a
**test phone number**; no real SMS is sent:

| Phone           | OTP    |
| --------------- | ------ |
| 01632 960001    | 123456 |
| 01632 960002    | 123456 |
| 01632 960003–5  | 123456 |

Not 07700 900xxx: the live server's test logins live in that range, and the
database won't start a new account on one.

To simulate two friends, sign up as one, grab your invite link from
**Friends**, sign out, sign up as another and open the link. Or skip the
manual setup entirely:

```sh
node scripts/seed-dev.mjs
```

Befriends all five test users with each other and sends a few live ravens, so
every account's **For you** tab has something to accept or decline immediately.

## Verify the social model

```sh
node scripts/smoke.mjs
```

Twenty-eight checks drive three users through sign-up → invite links → sending →
RSVPs → rewards → threads, asserting the privacy and points rules hold
(who's-in visible, declines and pending invisible, threads sender+attending
only, no ravens to non-friends, points awarded only for accepted RSVPs and
never self-assignable) along with the sign-up rules (no phone-only sign-ups,
no profile before a verified number, one account per number, the latest code
request for a number wins, no new accounts on the test range) and that deleting
an account removes all of it. Run against a clean database — `supabase db reset`
first if you've already run `seed-dev.mjs`, since it befriends everyone and
will trip the "declined/non-friend" checks.

## Rewards — who you are to your friends

Accepting a raven (I'm in / running late) earns 10 points; bailing gives them
back. Points set your level (New Messenger → Regular → Reliable → Trusted →
Inner Circle → Legend), and your level's colour rings your avatar everywhere —
the inbox, the friends list, the attendee list. Points are awarded by a
database trigger, never self-assignable (enforced via column-level grants).

Avatars are a real photo you upload in **Settings** (tap your picture), stored
in the `raven-media` Supabase Storage bucket. **Settings** is also where you delete
your account: it takes everything with it — profile, friendships, the ravens you
sent, your replies and RSVPs, your photos, and the login itself. No photo yet? You get your
initials in a ring instead — never a placeholder bird.

## History

Expired ravens never leave Postgres — expiry closes RSVPs and the chat, and the
inbox only shows live ones. Your private history lives under **Past** (web
`/past`, mobile via the header): everything you sent or received, read-only.

## Going hosted (when ready)

1. Create a project at https://supabase.com/dashboard/new
2. `supabase link --project-ref <ref>` then `supabase db push`
3. Dashboard → Auth → Sign In / Up → Phone: enable, keep phone confirmations
   on, add the test numbers above (or real Twilio credentials for real SMS)
4. Copy Project URL + anon key into `apps/web/.env.local`
   (see `.env.example`), deploy `apps/web` to Vercel, set the same env vars
   plus `NEXT_PUBLIC_APP_URL` to the deployed URL so invite links work.

## What's deliberately not here (V1)

Recipient pickers, availability status, calendars, recurring ravens, discovery,
feeds, likes, or anything that makes this feel like an event planner. The bar for
adding features: does it keep sending a raven as light as sending a text?
