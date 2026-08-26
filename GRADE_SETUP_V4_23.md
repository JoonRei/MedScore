# MedScores Term Grades — V4.23 setup

## 1. Run the database migration first

Open Supabase → SQL Editor and run:

```text
database/v4.23_term_grades.sql
```

Run this **before deploying the code update** because Student live sync and the new Grades pages query the new tables.

## 2. Admin workflow

1. Sign in as Admin.
2. Open **Assessments**.
3. Choose **Term Grades** (or open `/admin/grades`).
4. Select a Subject.
5. Configure grade components. The default starter setup is:
   - Quizzes & Long Exams — 50%
   - Term Examination — 50%
6. Assign each assessment to one component, or leave it **Not included**.
7. Make sure weights total exactly 100%.
8. Save the grading setup.
9. Review the Grade Preview.
10. Release complete grades. Students with missing/absent required assessments remain **Incomplete** and are skipped.

## 3. Grade math

MedScores keeps assessment scores and term grades separate.

For each component:

```text
component percentage = total points earned / total possible points × 100
```

Then:

```text
weighted raw percentage = Σ(component percentage × component weight)
```

Base-40 is applied **once** to that final weighted raw percentage:

```text
term grade = 40 + (weighted raw percentage × 0.60)
```

Example:

```text
Quizzes & Long Exams: 80% × 50% = 40
Term Examination:     70% × 50% = 35
Weighted performance:              75%
Base-40 term grade: 40 + (75 × .60) = 85
```

## 4. Important behavior

- A real score of `0` is valid and is included as zero earned points.
- A missing score is **not** treated as zero.
- An `absent` assessment keeps the term grade Incomplete in this first release.
- Components with no assigned assessment keep the grade Incomplete.
- Released grades are snapshots. Later score/config changes do not silently rewrite what the student already saw until faculty releases again.
- Every release/re-release is also written to `term_grade_release_history` for audit history.
- The numerical grade is not included in the push notification for privacy.

## 5. Student workflow

Students can open **Term Grades** from the Student Home card or `/student/grades`.
Each released grade shows:

- Subject
- Term grade
- Weighted raw percentage
- Component performance
- Component weight
- Weighted contribution
- Release date

The page explicitly distinguishes a term grade from an individual assessment score.
