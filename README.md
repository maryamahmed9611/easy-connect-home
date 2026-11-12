# Smart Elderly Care Ecosystem

A voice-first app for elderly users with three main features:
- Medical Support — real emergency calling with location and ambulance fallback
- Daily Needs — voice-ordered groceries, connected to a real local shop via automated call and WhatsApp
- Talk to Family — one-tap calling to saved family contacts

Built as a mini project.

## Tech stack
- Lovable (front end, React + TanStack Start)
- Lovable Cloud / Supabase (database: `requests`, `contacts`)
- Meta WhatsApp Cloud API (caregiver and shop alerts, sent from the server)
- Smallest AI (natural voice for the spoken confirmation; falls back to the browser voice)
- Browser Web Speech API (Tap and Speak voice recognition) and Geolocation API (Google Maps link)
- Phone dialer via `tel:` links (family, shop and ambulance calls)

## Server secrets (set in Lovable Cloud → Secrets, never in code)
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` – WhatsApp alerts
- `SMALLEST_AI_API_KEY` – natural voice
- `WHATSAPP_TEST_NUMBER` (optional) – test mode: every alert goes to this number instead of real contacts.
  The older `TWILIO_TEST_NUMBER` is still honoured if set; remove it to turn test mode off.

On first request after each deploy, the server writes a `[config-status]` line to the server logs showing
which secrets are set (never their values) and whether Meta accepts the WhatsApp token.

## Team
- Maryam
- Fauzia
- Muskan
- Soumya
