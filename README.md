# MedScores V4.7

V4.7 refines the Student sign-in experience and PWA branding without changing the semester roster or scoring workflow.

## Changes
- Uses **Fingerprint** wording consistently in the Student portal.
- Adds a dedicated fingerprint sign-in control with a subtle scan animation.
- Fingerprint sign-in remains disabled until the entered code name has fingerprint sign-in enabled.
- Removes the visual divider around/below the fingerprint sign-in action.
- Centers the Student sign-in screen on phones and prevents page scrolling, with compact spacing for short iPhone/Android viewports.
- Keeps secure device verification required for fingerprint sign-in.
- Uses `public/logo.png` as the main PWA launcher artwork and regenerates the smaller install icons from the same logo.

## Database
No new migration is required for V4.7.

If the V4.6 roster repair has not been run yet, run `database/v4.6_student_roster_repair.sql` once before testing semester rosters.
