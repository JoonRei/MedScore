# MedScores V4.7 Update

1. Copy the contents of this folder over the current MedScores V4.6 project.
2. Keep your existing `public/logo.png`; V4.7 points the installed PWA to that canonical logo.
3. Run `npm install` only if dependencies are missing, then run `npm run dev`.
4. Test Student sign-in on desktop and a phone-sized viewport.

No new database migration is required.

If the V4.6 semester-roster repair was never run, run `database/v4.6_student_roster_repair.sql` once before testing semester rosters.
