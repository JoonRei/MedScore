# MedScores V4.22

V4.22 keeps device notification opt-in persistent, moves phone notification controls into Student Settings, and refreshes Student Home recent results.

## Highlights

- **Phone notifications** are managed from Student Settings.
- Existing granted notification permission is automatically reconnected/synced instead of appearing Off after refresh.
- Released scores continue to update the in-app Notifications page in real time.
- Student Home **Recent results** uses clean, display-only summary cards with no text selection.
- Notification icon and device notification artwork continue to use the existing `public/logo.png`.
- No new database migration is required beyond the V4.21 push-subscription table.

See `SETUP.md` for the Web Push environment requirements.
