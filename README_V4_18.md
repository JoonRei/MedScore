# MedScores V4.18

This update focuses on polish and consistency.

## Changes
- Rebuilt the Achievement Board swipe interaction as a stable single-card carousel with a controlled incoming card during transitions.
- Removed the V4.17 cloned-track carousel behavior.
- Added a polished responsive skeleton system for Admin, Student, and Achievement Board loading states.
- Organized shared #4 and #5 ranks into compact code-name chips with one shared score.
- Added height-safe carousel overlap so larger tied-rank groups do not clip while swiping.
- Kept `public/logo.png` unchanged for all in-app branding.
- Added install-only PWA icon assets derived from the existing logo with transparent breathing room and no background/container.
- Removed maskable icon usage so the app does not request an adaptive shaped icon treatment.

No database migration is required.
