# Replace Twilio with Background WhatsApp, Direct Dialing, and Natural Voices

## What changes for the user
- Medical Support and Daily Needs: after speaking, the request is saved and a WhatsApp alert goes out quietly in the background. The senior never leaves the app.
- Right after, the phone's own dialer opens with the family number (Medical) or the shop number (Daily Needs), so the senior can talk directly.
- The Confirmed screen says "Help alert sent. Calling now." in the chosen language and shows a large "Call Ambulance" button when an ambulance number is saved. It still returns home on its own after a few seconds.
- The confirmation is spoken in a natural English, Hindi, or Kannada voice from Smallest AI. If that voice can't load, the phone's built-in voice is used, so the app never stays silent.
- Talk to Family, the screens, and the design stay exactly as they are.

## What you will need to provide
- WhatsApp Cloud API details from Meta (free to start): a **permanent access token** and the **phone number ID** for your WhatsApp Business number. I will ask for these through a secure form after you approve this plan.
- Until those are saved, the call and ambulance button still work, and the WhatsApp step is skipped without stopping the flow.

## Steps
1. Turn off the automatic Twilio call that runs when a request is saved. Keep the Twilio code, but make sure it no longer runs.
2. Add a secure server step that sends the WhatsApp message through Meta's Cloud API:
   - Medical: name, details, and a Google Maps link to the location.
   - Groceries: the order details.
   - Honors the existing test number (+919611947354) while test mode is on.
3. Change the app flow to: save request, then send WhatsApp in the background, then mark the request confirmed, then open the dialer with `tel:`.
4. Add the Confirmed-screen status line and the Call Ambulance button (100px or taller, large text).
5. Add a server step that turns text into speech with Smallest AI for en/hi/kn. Play it on Confirmed and fall back to the browser voice if it fails.
6. Test the whole flow in all three languages with the phone's voice and dialer mocked, and try one live Smallest AI voice clip.

## Technical details
- Server functions: `sendWhatsAppAlert` (in `src/lib/alerts.functions.ts`) posts to `graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`. It reads `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` inside the handler, loads the row by id using supabaseAdmin, and sets status to `confirmed` once the send succeeds or is skipped. Errors are logged, the status stays pending, and the client still dials.
- Note: free-form text only reaches people who messaged the business in the last 24 hours. Otherwise Meta needs an approved template. Template support will be added once a template name is supplied.
- `speak` server route (`/api/tts`) calls the Smallest AI TTS API with `SMALLEST_AI_API_KEY` and streams the audio back. The client plays it with `<audio>` and falls back to `speechSynthesis` on any error.
- Migration: drop the `notify_new_request` trigger on `requests`. `notify_config` stays but is unused.
- Dialer: `window.location.href = "tel:..."` runs after the save and WhatsApp step, on the same user-initiated flow. The ambulance button is a plain `tel:` link.
