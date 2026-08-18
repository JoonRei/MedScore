# MedScores V4.0

V4.0 adds the requested academic workflow and safety improvements while preserving the V3.8 design and existing data model.

## New in V4.0

- Release Confirmation Summary before scores are released
- New Result indicator with per-student viewed tracking
- Unsaved Score Protection
- Keyboard-friendly score entry (Enter/Arrow Down/Arrow Up)
- Stronger client + server score validation
- PWA / Add to Home Screen support
- Academic Year & Semester Management with one Current period

## Required database migration

Run this file once in Supabase SQL Editor before deploying V4.0:

`supabase/v4.0_academic_periods_new_results.sql`

The migration is additive. It keeps existing subjects, assessments, scores, students and enrollments. Existing subject academic periods are copied into the new managed period list.

## Academic periods

Admin → Settings now manages Academic Year + Semester entries. Exactly one can be Current. New subjects default to the Current period, while an Admin can still choose another managed period in the subject form.

## Release confirmation

Release Scores now shows Enrolled, Scored, Did not take and Not entered counts. Releasing is still allowed when entries are missing, but the Admin sees a clear warning first.

## New result indicator

Released student results show New until the student opens that result. The view is stored per student and assessment. Returning an assessment to Draft and releasing it again refreshes the release time so it can appear New again.

## Score entry protections

- Invalid scores outside 0–maximum are highlighted and cannot be saved.
- Bulk paste rejects too many rows and out-of-range values.
- Server validation also verifies that score rows belong to students enrolled in the assessment subject.
- Enter / Arrow Down moves to the next score input; Arrow Up moves back.
- Focusing a score selects its current value, so typing replaces it directly.
- Unsaved changes warn before closing/reloading or following another app link.

## PWA

MedScores includes a web app manifest, install icons, Apple Home Screen metadata and a lightweight service worker. The service worker intentionally does not cache protected pages or academic API responses.
