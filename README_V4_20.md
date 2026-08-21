# MedScores V4.20

V4.20 refines the Achievement Board and adds live Student score updates.

## Changes

- Removed the extra `tied`, `Shared position`, and `Outstanding scorer` labels from leaderboard ranks #4 and #5.
- All transient action toasts now auto-dismiss after 3 seconds.
- Added a Student Score Updates center with an unread badge.
- Newly released results appear in the Student portal automatically while the portal is open.
- A newly released score triggers a compact 3-second toast and refreshes the current Student page.
- Opening a result clears that assessment from unread score updates.
- Live updates reconnect automatically after short stream windows or connection interruptions.
- Existing `released_at` and Student result-view tracking are reused, so no new database migration is required.

## Notes

The live update connection is active while the Student portal is open. It uses the authenticated Student session and does not expose another student's results.
