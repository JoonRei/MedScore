# MedScores V4.11

V4.11 restores the clearer Achievement Board score presentation and adds compact class score context to Student Results.

## Changes
- Achievement Board top-right summary restored to **Max score**.
- Podium and #4/#5 scores restored to `score / total`.
- Removed the rotating silver/glass border line from leaderboard cards.
- Kept the smooth depth carousel and a soft static glass reflection.
- Student Results cards now show `points out of total` plus Low, Mean, and High for the same assessment.
- Added a compact score-range visualization showing the student's score against the class mean.
- Aggregate statistics include scored entries only and do not expose other student identities.
- Correctly distinguishes Not entered from Did not take in Student Results.

## Database
No new migration is required for V4.11.


## V4.10 carousel refinement

- Continuous depth interpolation while swiping: the outgoing card shrinks/blurs as the incoming card grows/sharpens.
- Stronger minimized previous/next cards with smoother spotlight transitions.
- Glass-like active card surface with animated edge refraction and subtle internal reflection.
- Timed rotation, swipe navigation, shared ranks, and existing leaderboard data behavior remain unchanged.

# MedScores V4.9

V4.9 refines the Student Achievement Board into a spotlight-style swipe carousel while keeping all V4.8 scoring, semester, fingerprint, roster, and PWA behavior intact.

## Changes
- Removed the tap-to-open Outstanding Students modal and all card tap actions.
- Achievement Board remains timed and manually swipeable.
- The active leaderboard card is enlarged, sharp, and visually spotlighted.
- Previous and next leaderboard cards remain partially visible with a soft blur, lower opacity, and reduced scale.
- Added smooth depth/position transitions and circular wrapping between the first and last boards.
- Added a restrained moving shine along the active card edge.
- Carousel height still follows the active card to prevent large blank areas.
- Tappable carousel markers remain available for direct navigation.
- Mean score presentation and shared-rank podium behavior remain unchanged.
- Reduced-motion preferences disable the moving shine and carousel animation.

## Database
No new migration is required for V4.9.
