# Smart Elderly Care Home Flow

## Build
- Replace the placeholder with a phone-first home screen containing exactly three large, vertically stacked action buttons.
- Add clear medical, shopping, family, and microphone icons with large labels and accessible names.
- Create a simple listening view for each action, with a pulsing microphone, “Listening...” status, and an empty read-only speech text area.
- Let the listening view advance to a confirmation view with a checkmark and a large Done button returning home.
- Keep every view centered within one phone screen without scrolling.

## Visual direction
- Use a warm neutral background with high-contrast navy text, calm blue and green actions, and a strong red medical action.
- Use large type, generous spacing, obvious focus states, and controls at least 100px tall.
- Keep navigation and decoration to the minimum required.

## Technical details
- Implement the flow as local React state on the home route, without persistence or backend services.
- Define all colors and typography through semantic tokens in the global design system.
- Add route-specific page metadata and verify desktop and phone-sized rendering.
