# Poker Faces: shallow perspective study

Scope: isolated visual and motion study based on verified v0.66.1 (e64b2158).
The rejected atmosphere experiment is excluded from this branch.

Plan: preserve the shipped Emerald materials, cream cards and key finishes.
Separate the receding felt plane from upright opponent cabinets. Add a shallow
console slope and a front face. Compare both views on one staged ordinary flop;
provide key-press and card-landing demonstrations. No poker/economy changes,
no dependency, no production entry point, service worker or version change.
Storage is volatile in the lab copy. This is not a playable mode.

Check: baseline and final npm test; visually inspect narrow and phone-height
viewports, switching and motion. Real-device touch remains a follow-up.
Bundle with the existing lab bundler. Artifact publishing is unavailable in
this session; deliver the local preview and portable bundle.

## Result · 7 October 2026

Built a single current/perspective comparison with the shipped palette and
key families. The felt is a separate receding plane; opponents stay upright
with a small cabinet top and contact depth. The console casing slopes, while
instruments and the bank retain their original geometry. Tilting the whole
console made the existing bank visibility guard hide its chips, so this study
does not use that treatment. Card ranks remain legible sprite faces.

The original engine prepares a disposable flop, then the study fixes its
visible cards. Actions are captured for a press demonstration; they do not
advance the hand. The landing replay is a motion sketch, not a replacement
for the existing dealer/flip choreography.

Validation: baseline 25/25 suites in 320s; subsequent npm test 25/25 in 313s.
Both new scripts pass syntax checks. Current/perspective switches preserve
the visible hand; key press and all three card landing animations observed.
Cold-load scenes inspected at 390×844 and 320×700; no console errors observed
in the portable preview. Real iPhone touch and performance are unverified.
Resizing an already loaded scene can misplace/hide the original chip overlays;
reload at the intended size. No production code, saves or version changed.

Local preview: http://127.0.0.1:18766/preview.html
Portable bundle and comparison captures live in this chat's perspective
artifact folder. Private Artifact publication is unavailable with these tools.
