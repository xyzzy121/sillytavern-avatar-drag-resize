# Audit and validation notes

The 2.3.0 work addresses concrete defects found in upstream `dd3a7edf00bfe1d79fe9e162e84003a2372ab70b`.

| Finding | Resolution |
| --- | --- |
| Mobile centering forced an offset of at least 150 px, default 200 px | Fit uses visual-viewport geometry; the obsolete bias is no longer applied |
| Close moved/rotated with the image and could depend on native hover visibility | Independent Close/Fit toolbar stays within the visible viewport |
| One save timer read shared gesture state after a delay | Snapshot values per identity, independent timers, cancellation on reset |
| Disable left CSS, observers, image replacements, and buttons active | Managed CSS scope and complete deactivate/restore path |
| Touch and pointer button handlers both executed | One coordinated pointer/repeat path plus native keyboard click activation |
| Touch gestures could rotate at edges, mix avatars, or lose the remaining finger after pinch | Explicit pointer ownership and gesture transitions |
| Two rapid drags could trigger double-tap reset | Completed stationary taps are required |
| Image reset affected other avatars and observers survived cleanup | Identity-scoped resets and tracked disposable records |
| Uploaded data was stored before successful image decoding | Validate format, size, and decode before persisting |
| Settings buttons used unrelated fixed colors | Native theme variables and standard SillyTavern controls |

## Validation

- Node tests cover fit geometry, corrupt settings, independent save snapshots, reset cancellation, gesture state transitions, gesture ownership, long-press tolerance, and image validation/cancellation.
- Chromium tests cover on-screen Close/Fit through extreme transforms and orientation changes, keyboard and pointer activation, hold repetition, disable/regenerate, independent avatar saves and custom images, and responsive theme layouts.
- A real SillyTavern 1.18.0 instance with an isolated data directory verifies the native settings drawer and chat-click handler, tall image fitting, hover-magnification compatibility, Visual Novel layout, Close, and regeneration.
- The main SillyTavern checkout's tracked files are not changed. Test profiles and screenshots are ignored by Git.

## Remaining follow-up opportunities

- Test on physical iOS Safari and Android browsers, especially keyboard opening and notched screens. Browser emulation cannot fully reproduce these behaviors.
- Large custom images still live in the shared settings document, matching upstream. A future migration to SillyTavern-managed image files could reduce settings size, but needs a separate compatibility design.
- Per-device saved positions could avoid adapting one desktop layout on a phone. This release preserves upstream's shared positions and clamps them to the current viewport.
- Translated UI strings could be added using SillyTavern's localization workflow.
