# Add Waiting Screen and Refine Home Visuals

## Changes
- Extend the existing flow to Home → Listening → Waiting → Confirmed → Home.
- Change the Listening screen’s confirmation action to open a new Waiting screen.
- Show “Support is on the way, please wait” in large, readable text with a gentle warm loading animation.
- Automatically advance from Waiting to Confirmed after a few seconds, with no controls on Waiting.
- Remove the small top-corner microphone from Home, leaving only the large central voice action.
- Replace the flat cream background with a richer warm peach-to-cream gradient while preserving text and button contrast.

## Technical Details
- Add a `waiting` screen state and a short effect-driven timer with cleanup.
- Reuse the selected care action and existing confirmation screen unchanged.
- Define the background gradient and waiting animation through semantic design tokens and reduced-motion-safe CSS.
- Verify the complete flow and no-scroll layout on phone and short-screen viewports.
