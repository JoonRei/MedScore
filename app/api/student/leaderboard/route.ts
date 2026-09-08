import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

const LEADERBOARD_TYPE_ALIASES = new Map<string, string>([
  ["long exam", "Long Exam"],
  ["long examination", "Long Exam"],
  ["prelim exam", "Prelim Examination"],
  ["prelim examination", "Prelim Examination"],
  ["preliminary exam", "Prelim Examination"],
  ["preliminary examination", "Prelim Examination"],
  ["midterm exam", "Midterm Examination"],
  ["midterm examination", "Midterm Examination"],
  ["mid-term exam", "Midterm Examination"],
  ["mid-term examination", "Midterm Examination"],
  ["final exam", "Final Examination"],
  ["final examination", "Final Examination"],
]);

function canonicalLeaderboardType(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return LEADERBOARD_TYPE_ALIASES.get(normalized) || null;
}

type StudentRow = { id: string; code_name: string };
type SubjectRow = { id: string; name: string; code: string | null; is_archived: boolean; academic_year: string; term: string };
type AssessmentRow = {
  id: string;
  subject_id: string;
  title: string;
  assessment_type: string;
  total_score: number;
  assessment_date: string;
  doctor_name: string | null;
  released_at: string | null;
};
type ScoreRow = {
  student_id: string;
  assessment_id: string;
  score: number | null;
  result_status: string;
};
type RankedEntry = { codeName: string; score: number; rank: number; isCurrent: boolean };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function rankAssessment(
  assessment: AssessmentRow,
  enrolledStudentIds: Set<string>,
  studentsById: Map<string, StudentRow>,
  scoreRows: ScoreRow[],
  currentStudentId: string,
  subject: SubjectRow
) {
  const ordered = scoreRows
    .filter((row) =>
      row.assessment_id === assessment.id &&
      row.result_status === "scored" &&
      row.score !== null &&
      enrolledStudentIds.has(row.student_id)
    )
    .flatMap((row): Array<Omit<RankedEntry, "rank">> => {
      const student = studentsById.get(row.student_id);
      if (!student) return [];
      return [{
        codeName: student.code_name,
        score: Number(row.score),
        isCurrent: row.student_id === currentStudentId,
      }];
    })
    .sort((a, b) => b.score - a.score || a.codeName.localeCompare(b.codeName));

  let denseRank = 0;
  let previousScore: number | null = null;
  const ranked: RankedEntry[] = ordered.map((entry) => {
    if (previousScore === null || entry.score !== previousScore) {
      denseRank += 1;
      previousScore = entry.score;
    }
    return { ...entry, rank: denseRank };
  });

  // Keep every student tied within the first five score positions. This means
  // a tied rank is never split across different visual placements.
  const top = ranked.filter((entry) => entry.rank <= 5);
  const current = ranked.find((entry) => entry.isCurrent);
  const currentRaw = scoreRows.find((row) => row.assessment_id === assessment.id && row.student_id === currentStudentId);

  return {
    id: assessment.id,
    title: assessment.title,
    type: canonicalLeaderboardType(assessment.assessment_type) || assessment.assessment_type,
    totalScore: Number(assessment.total_score),
    date: assessment.assessment_date,
    doctorName: assessment.doctor_name,
    releasedAt: assessment.released_at,
    subjectId: subject.id,
    subjectName: subject.name,
    subjectCode: subject.code,
    top,
    currentRank: current?.rank ?? null,
    currentScore: current?.score ?? null,
    currentStatus: currentRaw?.result_status || "not_entered",
    totalRanked: ranked.length,
  };
}

export async function GET() {
  const session = await getStudentSession();
  if (!session) return json({ error: "Unauthorized" }, 401);

  const db = createAdminClient();
  const { data: activePeriod } = await db.from("academic_periods").select("academic_year,term").eq("owner_id", session.student.owner_id).eq("is_active", true).maybeSingle();

  const { data: ownEnrollments, error: enrollmentError } = await db
    .from("enrollments")
    .select("subject_id")
    .eq("student_id", session.student.id);

  if (enrollmentError) {
    console.error("leaderboard: enrollment query failed", enrollmentError);
    return json({ error: "Unable to load the achievement board." }, 500);
  }

  const subjectIds = Array.from(new Set((ownEnrollments || []).map((row: any) => row.subject_id as string)));
  if (!subjectIds.length) return json({ boards: [] });

  const { data: subjectData, error: subjectError } = await db
    .from("subjects")
    .select("id,name,code,is_archived,academic_year,term")
    .in("id", subjectIds);

  if (subjectError) {
    console.error("leaderboard: subject query failed", subjectError);
    return json({ error: "Unable to load the achievement board." }, 500);
  }

  const subjects = ((subjectData || []) as SubjectRow[]).filter((subject) => !subject.is_archived && (!activePeriod || (subject.academic_year === activePeriod.academic_year && subject.term === activePeriod.term)));
  const activeSubjectIds = subjects.map((subject) => subject.id);
  if (!activeSubjectIds.length) return json({ boards: [] });

  let assessmentRows: AssessmentRow[] = [];
  const assessmentQuery = await db
    .from("assessments")
    .select("id,subject_id,title,assessment_type,total_score,assessment_date,doctor_name,released_at")
    .in("subject_id", activeSubjectIds)
    .eq("status", "published")
    .not("released_at", "is", null)
    .order("released_at", { ascending: false })
    .order("assessment_date", { ascending: false });

  if (assessmentQuery.error) {
    const fallback = await db
      .from("assessments")
      .select("id,subject_id,title,assessment_type,total_score,assessment_date,released_at")
      .in("subject_id", activeSubjectIds)
      .eq("status", "published")
      .not("released_at", "is", null)
        .order("released_at", { ascending: false })
      .order("assessment_date", { ascending: false });

    if (fallback.error) {
      console.error("leaderboard: assessment query failed", assessmentQuery.error, fallback.error);
      return json({ error: "Unable to load assessment rankings." }, 500);
    }
    assessmentRows = (fallback.data || [])
      .map((row: any) => ({ ...row, doctor_name: null }))
      .filter((row: any) => Boolean(canonicalLeaderboardType(row.assessment_type))) as AssessmentRow[];
  } else {
    assessmentRows = ((assessmentQuery.data || []) as AssessmentRow[])
      .filter((row) => Boolean(canonicalLeaderboardType(row.assessment_type)));
  }

  if (!assessmentRows.length) return json({ boards: [] });

  const { data: cohortData, error: cohortError } = await db
    .from("enrollments")
    .select("subject_id,student_id")
    .in("subject_id", activeSubjectIds);

  if (cohortError) {
    console.error("leaderboard: roster query failed", cohortError);
    return json({ error: "Unable to load assessment rankings." }, 500);
  }

  const cohortIds = Array.from(new Set((cohortData || []).map((row: any) => row.student_id as string)));
  const assessmentIds = assessmentRows.map((assessment) => assessment.id);

  let studentRows: StudentRow[] = [];
  if (cohortIds.length) {
    const { data: students, error: studentError } = await db
      .from("students")
      .select("id,code_name")
      .in("id", cohortIds)
      .eq("is_active", true);

    if (studentError) {
      console.error("leaderboard: student query failed", studentError);
      return json({ error: "Unable to load assessment rankings." }, 500);
    }
    studentRows = (students || []) as StudentRow[];
  }

  let scoreRows: ScoreRow[] = [];
  if (assessmentIds.length) {
    const scoreQuery = await db
      .from("scores")
      .select("student_id,assessment_id,score,result_status")
      .in("assessment_id", assessmentIds);

    if (scoreQuery.error) {
      const fallback = await db
        .from("scores")
        .select("student_id,assessment_id,score")
        .in("assessment_id", assessmentIds);

      if (fallback.error) {
        console.error("leaderboard: score query failed", scoreQuery.error, fallback.error);
        return json({ error: "Unable to load assessment rankings." }, 500);
      }

      scoreRows = (fallback.data || []).map((row: any) => ({
        ...row,
        result_status: row.score === null ? "absent" : "scored",
      })) as ScoreRow[];
    } else {
      scoreRows = (scoreQuery.data || []) as ScoreRow[];
    }
  }

  const studentsById = new Map(studentRows.map((student) => [student.id, student]));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const enrollmentSets = new Map<string, Set<string>>();

  for (const row of cohortData || []) {
    const subjectId = (row as any).subject_id as string;
    const studentId = (row as any).student_id as string;
    if (!studentsById.has(studentId)) continue;
    if (!enrollmentSets.has(subjectId)) enrollmentSets.set(subjectId, new Set());
    enrollmentSets.get(subjectId)!.add(studentId);
  }

  const rankedBoards = assessmentRows
    .flatMap((assessment) => {
      const subject = subjectById.get(assessment.subject_id);
      if (!subject) return [];
      const board = rankAssessment(
        assessment,
        enrollmentSets.get(assessment.subject_id) || new Set<string>(),
        studentsById,
        scoreRows,
        session.student.id,
        subject
      );
      return board.top.length ? [board] : [];
    })
    .sort((a, b) => {
      const releasedDelta = new Date(b.releasedAt || 0).getTime() - new Date(a.releasedAt || 0).getTime();
      if (releasedDelta) return releasedDelta;
      const assessmentDateDelta = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (assessmentDateDelta) return assessmentDateDelta;
      return a.title.localeCompare(b.title);
    });

  // Keep the sequence deterministic and genuinely recent: newest release first.
  // Older rankings follow in release order rather than being interleaved by subject.
  return json({ boards: rankedBoards });
}
