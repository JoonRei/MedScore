# MedScores V4.6

V4.6 fixes legacy semester student visibility and tightens the Student page and Student Settings layout.

## Changes
- Restores legacy students to the original/earliest semester when the first semester-roster backfill placed standalone students in the wrong active semester.
- Uses current-semester subject enrollment as an additional roster recovery source.
- Student actions are aligned as `Copy`, `Smart paste`, and `Add student`.
- `Copy` stays visible but disabled when there is no earlier semester.
- Removes the divider immediately below the Fingerprint / Face ID row.
- Keeps the three Student actions aligned on desktop, tablet, Android, and narrow iPhone widths.

## One-time data repair
Run `database/v4.6_student_roster_repair.sql` once, then restart MedScores.

The repair does not copy old scores or subjects into a new semester. It only corrects semester membership for legacy student accounts.
