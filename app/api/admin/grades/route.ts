import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getGradeAdminUser } from "@/lib/admin-grade-auth";
import { calculateTermGrade } from "@/lib/grade-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTermGradeReleasePush } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function studentLabel(student: any, studentId: string) {
  const first = String(student?.first_name || student?.firstname || "").trim();
  const last = String(student?.last_name || student?.lastname || "").trim();
  const full = String(student?.full_name || student?.name || `${first} ${last}`).trim();
  return full || String(student?.code_name || student?.preferred_code || student?.student_number || studentId);
}

async function loadWorkspace(ownerId: string, subjectId?: string) {
  const db = createAdminClient();
  const { data: subjects, error: subjectsError } = await db
    .from("subjects")
    .select("id,name,code,term,academic_year")
    .eq("owner_id", ownerId)
    .order("academic_year", { ascending: false })
    .order("term", { ascending: false })
    .order("name", { ascending: true });
  if (subjectsError) throw subjectsError;

  if (!subjectId) return { subjects: subjects || [] };
  const subject = (subjects || []).find((row: any) => String(row.id) === subjectId);
  if (!subject) throw new Error("Subject not found or unavailable.");

  const { data: assessments, error: assessmentsError } = await db
    .from("assessments")
    .select("id,title,assessment_type,total_score,status,assessment_date")
    .eq("subject_id", subjectId)
    .order("assessment_date", { ascending: true });
  if (assessmentsError) throw assessmentsError;

  const { data: scheme, error: schemeError } = await db
    .from("grade_schemes")
    .select("id,name,rounding_digits")
    .eq("owner_id", ownerId)
    .eq("subject_id", subjectId)
    .maybeSingle();
  if (schemeError) throw schemeError;

  let components: any[] = [];
  const assignments: Record<string, string> = {};
  if (scheme) {
    const { data: componentRows, error: componentError } = await db
      .from("grade_components")
      .select("id,name,weight,sort_order")
      .eq("scheme_id", scheme.id)
      .order("sort_order", { ascending: true });
    if (componentError) throw componentError;
    components = (componentRows || []).map((row: any) => ({ ...row, weight: Number(row.weight) }));

    const componentIds = components.map((row) => row.id);
    if (componentIds.length) {
      const { data: assignmentRows, error: assignmentError } = await db
        .from("grade_component_assessments")
        .select("component_id,assessment_id")
        .in("component_id", componentIds);
      if (assignmentError) throw assignmentError;
      for (const row of assignmentRows || []) assignments[String(row.assessment_id)] = String(row.component_id);
    }
  }

  const assessmentRows = (assessments || []).map((row: any) => ({ ...row, total_score: Number(row.total_score) || 0 }));
  const assessmentIds = assessmentRows.map((row: any) => String(row.id));
  let scoreRows: any[] = [];
  if (assessmentIds.length) {
    const { data, error } = await db
      .from("scores")
      .select("student_id,assessment_id,score,result_status,students(*)")
      .in("assessment_id", assessmentIds);
    if (error) throw error;
    scoreRows = data || [];
  }

  const studentMap = new Map<string, any>();
  const scoresByStudent = new Map<string, any[]>();
  for (const row of scoreRows) {
    const studentId = String(row.student_id || "");
    if (!studentId) continue;
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    if (!studentMap.has(studentId)) studentMap.set(studentId, student || {});
    const bucket = scoresByStudent.get(studentId) || [];
    bucket.push({ assessmentId: String(row.assessment_id), score: row.score == null ? null : Number(row.score), resultStatus: row.result_status });
    scoresByStudent.set(studentId, bucket);
  }

  const configuredAssessments = assessmentRows
    .filter((row: any) => assignments[String(row.id)])
    .map((row: any) => ({
      id: String(row.id),
      title: String(row.title || "Assessment"),
      totalScore: Number(row.total_score) || 0,
      componentId: assignments[String(row.id)],
    }));
  const engineComponents = components.map((row: any) => ({ id: String(row.id), name: String(row.name), weight: Number(row.weight) || 0 }));

  const preview = Array.from(studentMap.entries()).map(([studentId, student]) => {
    const calculation = calculateTermGrade({
      components: engineComponents,
      assessments: configuredAssessments,
      scores: scoresByStudent.get(studentId) || [],
      roundingDigits: Number((scheme as any)?.rounding_digits || 0),
    });
    return {
      studentId,
      name: studentLabel(student, studentId),
      codeName: String(student?.code_name || student?.preferred_code || "") || null,
      complete: calculation.complete,
      rawPercentage: calculation.rawPercentage,
      termGrade: calculation.termGrade,
      missingCount: calculation.missingAssessmentIds.length,
      components: calculation.components.map((row) => ({
        name: row.name,
        earned: row.earned,
        possible: row.possible,
        percentage: row.percentage,
        componentGrade: row.componentGrade,
        weight: row.weight,
        contribution: row.contribution,
      })),
      breakdown: calculation.components,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return {
    subjects: subjects || [],
    subject,
    assessments: assessmentRows,
    scheme,
    components,
    assignments,
    preview,
  };
}

export async function GET(request: Request) {
  const user = await getGradeAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(request.url);
    const subjectId = String(url.searchParams.get("subjectId") || "").trim();
    const data = await loadWorkspace(user.id, subjectId || undefined);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("term grade workspace load failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load term grades." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getGradeAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  try {
    const body = await request.json();
    const action = String(body?.action || "");
    const subjectId = String(body?.subjectId || "").trim();
    if (!subjectId) return NextResponse.json({ error: "Subject is required." }, { status: 400 });

    const db = createAdminClient();
    const { data: subject, error: subjectError } = await db
      .from("subjects")
      .select("id,name")
      .eq("id", subjectId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (subjectError) throw subjectError;
    if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });

    if (action === "save_config") {
      const rawComponents: any[] = Array.isArray(body?.components) ? body.components : [];
      const components: Array<{ clientKey: string; name: string; weight: number; sortOrder: number }> = rawComponents.map((row: any, index: number) => ({
        clientKey: String(row?.clientKey || `component-${index}`),
        name: String(row?.name || "").trim(),
        weight: Number(row?.weight),
        sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : index,
      }));
      if (!components.length || components.some((row) => !row.name || !Number.isFinite(row.weight) || row.weight <= 0)) {
        return NextResponse.json({ error: "Every component needs a name and a positive weight." }, { status: 400 });
      }
      const totalWeight = components.reduce((sum, row) => sum + row.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.001) {
        return NextResponse.json({ error: `Component weights must total exactly 100%. Current total: ${totalWeight.toFixed(2)}%.` }, { status: 400 });
      }
      const roundingDigits = Math.min(2, Math.max(0, Math.trunc(Number(body?.roundingDigits) || 0)));
      const assignments: Array<{ assessmentId: string; componentKey: string }> = Array.isArray(body?.assignments) ? (body.assignments as any[]).map((row: any) => ({
        assessmentId: String(row?.assessmentId || "").trim(),
        componentKey: String(row?.componentKey || "").trim(),
      })).filter((row: any) => row.assessmentId && row.componentKey) : [];
      const componentKeys = new Set(components.map((row) => row.clientKey));
      if (assignments.some((row: any) => !componentKeys.has(row.componentKey))) {
        return NextResponse.json({ error: "One or more assessment assignments point to an invalid component." }, { status: 400 });
      }
      const assessmentIds = Array.from(new Set(assignments.map((row: any) => row.assessmentId)));
      if (assessmentIds.length) {
        const { data: ownedAssessments, error } = await db.from("assessments").select("id").eq("subject_id", subjectId).in("id", assessmentIds);
        if (error) throw error;
        if ((ownedAssessments || []).length !== assessmentIds.length) {
          return NextResponse.json({ error: "An assigned assessment does not belong to this subject." }, { status: 400 });
        }
      }

      const { data: existingScheme, error: existingError } = await db
        .from("grade_schemes")
        .select("id")
        .eq("owner_id", user.id)
        .eq("subject_id", subjectId)
        .maybeSingle();
      if (existingError) throw existingError;

      let schemeId = String(existingScheme?.id || "");
      if (schemeId) {
        const { error } = await db.from("grade_schemes").update({ rounding_digits: roundingDigits, updated_at: new Date().toISOString() }).eq("id", schemeId).eq("owner_id", user.id);
        if (error) throw error;
        const { error: deleteError } = await db.from("grade_components").delete().eq("scheme_id", schemeId);
        if (deleteError) throw deleteError;
      } else {
        const { data: insertedScheme, error } = await db.from("grade_schemes").insert({ owner_id: user.id, subject_id: subjectId, name: "Term Grade", rounding_digits: roundingDigits }).select("id").single();
        if (error) throw error;
        schemeId = String(insertedScheme.id);
      }

      const { data: insertedComponents, error: componentInsertError } = await db.from("grade_components").insert(
        components.map((row) => ({ scheme_id: schemeId, name: row.name, weight: row.weight, sort_order: row.sortOrder }))
      ).select("id,sort_order");
      if (componentInsertError) throw componentInsertError;

      const idBySortOrder = new Map((insertedComponents || []).map((row: any) => [Number(row.sort_order), String(row.id)]));
      const componentIdByKey = new Map(components.map((row) => [row.clientKey, idBySortOrder.get(row.sortOrder) || ""]));
      const assignmentRows = assignments.map((row: any) => ({ component_id: componentIdByKey.get(row.componentKey), assessment_id: row.assessmentId })).filter((row: any) => row.component_id);
      if (assignmentRows.length) {
        const { error } = await db.from("grade_component_assessments").insert(assignmentRows);
        if (error) throw error;
      }

      revalidatePath("/admin/grades");
      return NextResponse.json({ ok: true, schemeId });
    }

    if (action === "release") {
      const workspace: any = await loadWorkspace(user.id, subjectId);
      if (!workspace.scheme?.id) return NextResponse.json({ error: "Save a grading setup first." }, { status: 400 });
      const ready = (workspace.preview || []).filter((row: any) => row.complete && row.termGrade != null && row.rawPercentage != null);
      if (!ready.length) return NextResponse.json({ error: "No complete student grades are ready to release." }, { status: 400 });
      const now = new Date().toISOString();
      const rows = ready.map((row: any) => ({
        scheme_id: workspace.scheme.id,
        owner_id: user.id,
        subject_id: subjectId,
        student_id: row.studentId,
        raw_percentage: row.rawPercentage,
        term_grade: row.termGrade,
        breakdown: row.breakdown,
        released_at: now,
        updated_at: now,
      }));
      const { error: historyError } = await db.from("term_grade_release_history").insert(ready.map((row: any) => ({
        scheme_id: workspace.scheme.id,
        owner_id: user.id,
        subject_id: subjectId,
        student_id: row.studentId,
        raw_percentage: row.rawPercentage,
        term_grade: row.termGrade,
        breakdown: row.breakdown,
        released_at: now,
        released_by: user.id,
      })));
      if (historyError) throw historyError;

      const { error } = await db.from("released_term_grades").upsert(rows, { onConflict: "scheme_id,student_id" });
      if (error) throw error;

      await sendTermGradeReleasePush(ready.map((row: any) => String(row.studentId)), user.id, String(subject.name || "Subject"), String(workspace.scheme.id), now);
      revalidatePath("/admin/grades");
      revalidatePath("/student");
      revalidatePath("/student/grades");
      return NextResponse.json({ ok: true, released: ready.length, releasedAt: now });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    console.error("term grade action failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update term grades." }, { status: 500 });
  }
}
