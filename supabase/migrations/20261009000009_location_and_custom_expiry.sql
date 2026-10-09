-- Location: a free-text label the sender optionally attaches at compose
-- time ("The Perseverance pub, Broadway Market"), shown to recipients as a
-- tap-out link to Maps. No coordinates, no geocoding, no API key — the
-- label itself becomes the Maps search query client-side. Same shape as the
-- existing media_url: optional, set once at send, immutable after.
--
-- Custom expiry needs no schema change — it's still just an absolute
-- expires_at timestamp, computed client-side from a sender-chosen duration
-- instead of one of the four fixed presets. ravens.expires_at already
-- accepts any future timestamp.

alter table public.ravens add column location text
  check (location is null or char_length(location) between 1 and 140);
