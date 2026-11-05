# Avatar Manipulator for SillyTavern

Move, resize, and rotate the enlarged character or persona image opened from chat. This fork adds native SillyTavern styling and keeps **Close** and **Fit** reachable on mobile, even when the image is much larger than the screen.

Fork of [Matriarchy-cloud/sillytavern-avatar-drag-resize](https://github.com/Matriarchy-cloud/sillytavern-avatar-drag-resize), originally authored by lightdevice. Based on upstream commit `dd3a7edf00bfe1d79fe9e162e84003a2372ab70b`.

## Installation

1. In SillyTavern, open **Extensions → Install Extension**.
2. Paste `https://github.com/xyzzy121/sillytavern-avatar-drag-resize` and install.
3. Reload SillyTavern, then open **Extensions → Avatar Manipulator**.

Use this fork in place of the upstream extension. If upstream is already installed, disable or remove that installation before enabling the fork. Both use the same settings namespace, so existing positions, preferences, and custom image replacements remain compatible. Automatic updates remain disabled, as in upstream.

No Extras server, runtime package installation, or build step is required.

## Using the viewer

Click or tap a character/persona avatar in chat to open it.

| Action | Touch | Mouse / keyboard |
| --- | --- | --- |
| Move | Drag with one finger | Drag from the image interior |
| Resize | Pinch with two fingers | Scroll over the image |
| Rotate | Two fingers, when rotation is enabled | Drag near an outer edge |
| Fit to screen | Toolbar, double-tap, or stationary hold | Toolbar or double-click |
| Close | Toolbar X | Toolbar X |

The compact toolbar has Zoom Out, Zoom In, Fit, and Close. It stays inside the visible viewport and does not rotate or scale with the image. Fit centers the complete image, clears rotation and pan, and forgets that image's saved transform. Large images fit on first opening; intentional zoom beyond the screen is supported. Viewport and orientation changes adjust the layout.

The native extension drawer contains the same actions plus rotation, directional movement, and image replacement. Actions apply to the last image selected. Buttons support Enter/Space; holding a movement, zoom, or rotation button repeats its action. The Advanced section contains step sizes and gesture timing.

Image replacement changes this viewer only, not the stored character/persona card. Files must decode as an image and be at most 6 MB. Restore Original affects only the selected avatar identity. As in upstream, replacements are stored in SillyTavern's extension settings.

Disabling the extension restores native viewer layout and image sources. Saved preferences and replacements are retained for re-enabling it.

## Changes in 2.3.0

- Rebuilt settings with SillyTavern's drawers, controls, icons, and theme colors; added accessible controls and responsive layouts.
- Added an independent viewport-clamped toolbar, proper initial image fitting, and resize handling. Removed the forced mobile downward offset; the legacy `mobileYBias` setting is retained but ignored.
- Scoped styling to managed avatars and made enable/disable a complete lifecycle transition.
- Fixed position-save races between avatars and reset operations; saves capture each identity's own transform.
- Fixed duplicate touch button actions, keyboard activation, hold cancellation, one-finger edge rotation, cross-avatar gesture interference, pinch-to-drag transitions, and false double-tap resets during rapid drags.
- Fixed image reset affecting other avatars, invalid image handling, and leftover observers, timers, and callbacks during cleanup.
- Preserved `extensionSettings.avatar_manip`, saved keys, and `AvatarManip.init()`, `.cleanup()`, and `.regenerate()`.

## Development and validation

```sh
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

The browser fixture loads native styles from a sibling `SillyTavern/public` directory when available. Set `ST_PUBLIC_DIR` to use another checkout. It includes a minimal host contract so interaction tests also run without that checkout. Browser tests save visual previews under `artifacts/`.

For real-app integration, run a disposable SillyTavern instance with this extension installed. Set `ST_URL` to its localhost URL (default `http://127.0.0.1:4188`) and run `npm run test:integration`. This test completes onboarding if needed, adds a temporary synthetic message in the browser, and exercises the native avatar click handler. Use a disposable profile because it adjusts test settings. No AI connection is used.

Validated against SillyTavern 1.18.0 with Node and Chromium browser tests, including 320×568 and 390×844 mobile viewports, landscape, large images, theme inheritance, keyboard controls, independent saves/replacements, and repeated cleanup. Mobile validation uses browser emulation, not a physical phone; iOS Safari remains a useful follow-up check.

See [the audit and validation notes](AUDIT.md) for implementation details and remaining follow-up work.

## Attribution

Original extension: lightdevice / Matriarchy-cloud. Fork maintenance: xyzzy121.
The upstream README listed its license as `NULL`; this fork does not assign a new license to upstream code.
