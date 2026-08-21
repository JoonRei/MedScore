# MedScores V4.11 Update

1. Copy the V4.11 update files over the current MedScores project.
2. Run `npm install` if dependencies are not already installed.
3. Run `npm run dev`.
4. Check Student Home → Achievement Board and confirm **Max score** is restored and no rotating edge line appears.
5. Check Student → Results and confirm scored results show Low, Mean, and High class statistics.

No new database migration or environment change is required for V4.11.

# MedScores V4.6 Update

1. Copy the V4.6 update files over the current MedScores project.
2. Run `database/v4.6_student_roster_repair.sql` once in the project database console.
3. Run `npm install` if dependencies are not already installed.
4. Run `npm run dev`.
5. Open Admin → Settings and select **1st Semester**.
6. Open Admin → Students and confirm the original student roster is visible again.
7. Switch to a later semester and use **Copy** only for students continuing into that semester.

The repair does not copy old subjects or scores into another semester. No environment-variable changes are required.
