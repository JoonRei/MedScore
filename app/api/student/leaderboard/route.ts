import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

const LEADERBOARD_TYPES = ["Long Exam", "Prelim Examination", "Midterm Examination", "Final Examination"];

type StudentRow = { id: string; code_name: string };
type SubjectRow = { id: string; name: string; code: string | null; is_archived: boolean };
type AssessmentRow = {
  id: string;
  subject_id: string;
  title: string;
  assessment_type: string;
  total_score: number;
  assessment_date: string;
  doctor_name: string | null;
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
    type: assessment.assessment_type,
    totalScore: Number(assessment.total_score),
    date: assessment.assessment_date,
    doctorName: assessment.doctor_name,
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
    .select("id,name,code,is_archived")
    .in("id", subjectIds);

  if (subjectError) {
    console.error("leaderboard: subject query failed", subjectError);
    return json({ error: "Unable to load the achievement board." }, 500);
  }

  const subjects = ((subjectData || []) as SubjectRow[]).filter((subject) => !subject.is_archived);
  const activeSubjectIds = subjects.map((subject) => subject.id);
  if (!activeSubjectIds.length) return json({ boards: [] });

  let assessmentRows: AssessmentRow[] = [];
  const assessmentQuery = await db
    .from("assessments")
    .select("id,subject_id,title,assessment_type,total_score,assessment_date,doctor_name")
    .in("subject_id", activeSubjectIds)
    .eq("status", "published")
    .in("assessment_type", LEADERBOARD_TYPES)
    .order("assessment_date", { ascending: false });

  if (assessmentQuery.error) {
    const fallback = await db
      .from("assessments")
      .select("id,subject_id,title,assessment_type,total_score,assessment_date")
      .in("subject_id", activeSubjectIds)
      .eq("status", "published")
      .in("assessment_type", LEADERBOARD_TYPES)
      .order("assessment_date", { ascending: false });

    if (fallback.error) {
      console.error("leaderboard: assessment query failed", assessmentQuery.error, fallback.error);
      return json({ error: "Unable to load assessment rankings." }, 500);
    }
    assessmentRows = (fallback.data || []).map((row: any) => ({ ...row, doctor_name: null })) as AssessmentRow[];
  } else {
    assessmentRows = (assessmentQuery.data || []) as AssessmentRow[];
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
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.title.localeCompare(b.title));

  // Interleave subjects so the automatic showcase does not spend several slides
  // on one subject before students see another subject's Long Exams.
  const queues = new Map<string, typeof rankedBoards>();
  for (const board of rankedBoards) {
    const queue = queues.get(board.subjectId) || [];
    queue.push(board);
    queues.set(board.subjectId, queue);
  }

  const boards: typeof rankedBoards = [];
  const subjectOrder = subjects.map((subject) => subject.id).filter((id) => queues.has(id));
  let added = true;
  while (added) {
    added = false;
    for (const subjectId of subjectOrder) {
      const queue = queues.get(subjectId);
      if (queue?.length) {
        boards.push(queue.shift()!);
        added = true;
      }
    }
  }

  return json({ boards });
}
