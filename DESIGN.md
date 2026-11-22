# Dot Loader Studio interface

## Workflow

1. Choose a starting animation from the left library. Selecting a preset in frame mode chooses a source; only the explicit Generate action replaces frames.
2. Edit the active mask or frame in the center canvas. Drawing tools and the timeline are only shown in frame mode.
3. Adjust appearance, playback, or inspect the actual output size with the inspector's Style, Animation, and Preview tabs.
4. Export through one dialog. React, HTML, GIF, npm, terminal and project exports share the same active animation state. Project import is a separate header action.

The interface keeps technical export choices out of the main editing workspace. Undo is available for content edits and frame generation, matching the original engine's history scope. Settings remain saved under the original `dot-loader-studio:v1` localStorage key.

## Visual system

- Use official coss/ui components and neutral semantic tokens. Keep the artwork's colors independent from editor chrome.
- System fonts; 13px standard text, 11–12px supporting labels, 17px canvas title. Use monospace only for numeric output and code.
- Flat surfaces, fine dividers, minimal shadows. Use coss nested control radii rather than overriding child corners independently.
- Show explicit labels for uncommon controls. Icon actions have accessible names and tooltips. Fields support keyboard operation and dialogs manage focus through Base UI.
- No decorative motion. Actual loader playback is essential content; Pause stops the canvas and actual-size preview. Reduced-motion users start paused and see static preset thumbnails, and can opt in with Play.

## Responsive rules

- At 1024px and above, use a library / canvas / inspector workspace; reduce side-panel widths below 1200px.
- At 640–1023px, retain the library and move the inspector below the canvas.
- Below 640px, show the canvas first, a collapsible library second, and the inspector below. Header controls wrap onto two rows. Export dialogs stay within the viewport and scroll internally.

## Integration and performance

`src/lib/studio-engine.js` owns drawing, thumbnails, frame operations, project persistence and encoders. React owns application controls and dialogs. Only canvas/thumbnail containers use imperative DOM rendering.

The engine, export dialog and shortcut dialog are loaded on demand. Preset thumbnails render at 15fps and offscreen thumbnails do not animate. No external fonts or runtime CDN dependencies are needed.

Official coss sources are vendored under `src/components/ui`; see `THIRD_PARTY_NOTICES.md`. Local adaptations: import aliases, and an explicit opacity transition on the dialog backdrop.
