# MedScores V4.15

V4.15 refines the single-card Achievement Board carousel introduced in V4.14.

- Keeps exactly one leaderboard card visible at rest.
- Uses a softer, tighter card shadow with enough internal stage padding so the shadow does not look clipped.
- During a swipe, the incoming leaderboard is rendered underneath the outgoing card and crossfades in, eliminating the empty white flash between cards.
- Entry motion begins partially visible instead of fading in from fully transparent.
- Manual swipe, timed rotation, keyboard navigation, and carousel dots remain unchanged.
- No database migration is required.
