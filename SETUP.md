# MedScores V4.19 Setup

No database update is required for V4.19.

## Update from V4.18

Copy the V4.19 Update Only files over the current project, then run:

```powershell
npm run dev
```

V4.19 references only `public/logo.png` for app and install branding. The previous `public/pwa-icon-192.png`, `public/pwa-icon-512.png`, and `public/apple-touch-icon.png` files are no longer used. They may be removed from an older working copy if they still exist.

After checking the Student Settings and leaderboard, deploy normally.
