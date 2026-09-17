# Add Browser Voice and Language Selection

## Changes
- Show a first-open language screen with large English, हिंदी, and ಕನ್ನಡ choices, remembered for the browser session.
- Keep the existing home and care flow, adding a small language-change control on Home.
- Start browser speech recognition when any care option or the central microphone is selected, using en-IN, hi-IN, or kn-IN.
- Stream interim and final recognized words into the existing Listening text area.
- Automatically continue to Waiting when speech recognition ends successfully.
- Show a clear message on Listening when microphone permission is denied or speech recognition is unavailable, without breaking navigation.
- Speak the confirmation in the selected language, choosing the closest matching browser voice when an exact match is unavailable.

## Technical Details
- Add browser-safe Web Speech API type definitions and feature detection without new dependencies.
- Keep the active recognition instance in a ref, stop it on back navigation or cleanup, and ignore stale callbacks.
- Store only the language code in `sessionStorage` after hydration to avoid server-render mismatches.
- Use localized confirmation phrases: English, Hindi, and Kannada.
- Preserve the current screen styling and navigation structure aside from the requested language controls.
