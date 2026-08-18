# MedScores V4.0 update steps

1. Back up the current project/database as usual.
2. In Supabase SQL Editor, run `supabase/v4.0_academic_periods_new_results.sql` once.
3. Copy the V4.0 Update Only files over the current MedScores project.
4. Run `npm install` only if dependencies are not already installed.
5. Run `npm run dev` and test:
   - Admin → Settings → Academic year & semester
   - Admin → Subjects → Add subject
   - Admin → Assessments → Release scores
   - Admin → Enter scores → validation/keyboard/unsaved warning
   - Student → Results → New badge + open result
   - Admin/Student → Settings → Install MedScores
6. Deploy normally through GitHub/Vercel.

No environment-variable changes are required.
