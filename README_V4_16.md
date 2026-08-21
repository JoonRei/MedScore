# MedScores V4.16

Focused carousel continuity and responsive loading-state polish.

- Removes the leaderboard's end-of-transition blink by using one continuous card handoff with no second enter/remount animation.
- Keeps the incoming leaderboard underneath the outgoing card until it has reached the final visual state.
- Keeps swipe, timed rotation, keyboard navigation, and carousel dots.
- Reworks Admin and Student route skeletons into one consistent responsive layout.
- Keeps phone loading stats in a clean 2×2 grid and scales down spacing/heights on narrow screens.
- Reworks the Achievement Board skeleton to match the real leaderboard card proportions.
- Replaces busy moving shimmer with a subtle opacity pulse and respects reduced-motion preferences.
- No database migration is required.
