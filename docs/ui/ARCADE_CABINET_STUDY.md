# Pixel arcade cabinet composition · v0.66.1

User-authorized full visual redesign experiment, isolated from the main game.
One composed screen: three upright pixel arcade cabinets with marquees,
recessed faces, side profiles, shelves/card slots, feet and contact shadows.
A receding green felt tabletop joins a burgundy wedge console: recessed
bank with stepped shelves, cream cards in a brass holder, instrument bays,
mechanical stack figures, wager fader and the familiar action-key colours.

Plan: author geometry as crisp canvas pixel art (integer scanline polygons),
reuse the existing face art and its colour mapping, chip art and game font.
Use native accessible buttons over the drawing for cabinet and key motion.
No dependencies, poker changes, Career changes, save/version/cache changes.
No production entry point; candidate finishes remain lab-only.

Deliver one scene with cabinet action and press/release motion plus a card
landing sketch; motion can be disabled. Test phone and narrow layouts,
keyboard input and the bundle, then stop for the owner's visual assessment.
Baseline npm test: 25/25 in 291s.

Usage checkpoint before work: account five-hour usage 1%, weekly 15%.

## Completed experiment

Rendered geometry uses integer scanline polygons, hard material bands and
subtle woven/dithered felt. Completed card sprites are rotated as whole images
to avoid scanline seams. Face portraits reuse the existing art and calibrated
colour mapping; chip images reuse the current game assets. The stack figures
use authored bitmap digits to stay legible at the small scene resolution.

The player controls are stage demonstrations only. Displays, fader, P.I.P.
and bank are illustrative; no poker state is created or advanced. Tapping
an opponent shows its turn lamp, CHECK readout and mechanical settle. Main
keys sink while held and settle on release. The replay combines an opponent
check with three card landings. Motion is optional; reduced-motion users get
static feedback. Rendering runs on resize and bounded interaction sequences.

Validation: final npm test 25/25 in 228s; both scripts pass syntax checks.
Portable baked preview checked at 390×844, 390×667 and 320×700. Cabinets,
community cards, pot readout and card holder remain separated; controls fit.
Pointer and Space-key press/release, cabinet feedback, motion toggle, Escape
close and table replay verified. Visible tap targets meet 44px minimum height.
A startup MutationObserver warning surfaced after reloading the baked preview
(the same warning appeared in the previous lab); its source is unconfirmed.
The composition and controls remained functional. Actual iPhone touch/performance remain
unverified; the touch harness was not used because this session's browser
policy requires all browser interaction through the CUA tool.

Preview: http://127.0.0.1:18767/preview.html
Captures and portable ZIP: this chat's `poker-v0661/cabinets` output folder.
Private Artifact publishing is not available in this session; local preview
and portable bundle are delivered instead. No production release or merge.

Usage checkpoint at completed visual verification: five-hour allowance 16%
used (from 1%); weekly 17% (from 15%). Account-wide counters include any other
concurrent work; the difference is not exact billing for this task.
