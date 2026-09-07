import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getGradeAdminUser } from "@/lib/admin-grade-auth";
import { calculateTermGrade, calculateWeightedTermGrade } from "@/lib/grade-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTermGradeReleasePush } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const PERIODS = new Set(["prelim", "midterm", "finals"]);

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function normalizePeriod(value: unknown) {
  const period = String(value || "prelim").toLowerCase();
  return PERIODS.has(period) ? period : "prelim";
}

function studentLabel(student: any, studentId: string) {
  const first = String(student?.first_name || student?.firstname || "").trim();
  const last = String(student?.last_name || student?.lastname || "").trim();
  if (last && first) return `${last}, ${first}`;
  if (last) return last;
  if (first) return first;
  const full = String(student?.full_name || student?.name || "").trim();
  return full || String(student?.code_name || student?.preferred_code || student?.student_number || studentId);
}

async function loadWorkspace(ownerId: string, subjectId?: string, gradingPeriod = "prelim", requestedTrackKey?: string) {
  const db = createAdminClient();
  const period = normalizePeriod(gradingPeriod);
  const { data: subjects, error: subjectsError } = await db
    .from("subjects")
    .select("id,name,code,term,academic_year")
    .eq("owner_id", ownerId)
    .order("academic_year", { ascending: false })
    .order("term", { ascending: false })
    .order("name", { ascending: true });
  if (subjectsError) throw subjectsError;

  if (!subjectId) return { subjects: subjects || [], gradingPeriod: period, tracks: [] };
  const subject = (subjects || []).find((row: any) => String(row.id) === subjectId);
  if (!subject) throw new Error("Subject not found or unavailable.");

  const [{ data: assessments, error: assessmentsError }, { data: allSchemes, error: schemesError }] = await Promise.all([
    db.from("assessments")
      .select("id,title,assessment_type,total_score,status,assessment_date")
      .eq("subject_id", subjectId)
      .order("assessment_date", { ascending: true }),
    db.from("grade_schemes")
      .select("id,name,rounding_digits,grading_period,track_key,track_name,track_sort_order,subject_weight")
      .eq("owner_id", ownerId)
      .eq("subject_id", subjectId)
      .order("track_sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  if (assessmentsError) throw assessmentsError;
  if (schemesError) throw schemesError;

  const schemes = allSchemes || [];
  const periodSchemes = schemes.filter((row: any) => String(row.grading_period || "prelim") === period);
  const selectedScheme = requestedTrackKey
    ? periodSchemes.find((row: any) => String(row.track_key) === requestedTrackKey) || periodSchemes[0] || null
    : periodSchemes[0] || null;

  const schemeIds = schemes.map((row: any) => String(row.id));
  let allComponents: any[] = [];
  let allAssignmentRows: any[] = [];
  if (schemeIds.length) {
    const { data: componentRows, error: componentError } = await db
      .from("grade_components")
      .select("id,scheme_id,name,weight,sort_order,parent_component_id")
      .in("scheme_id", schemeIds)
      .order("sort_order", { ascending: true });
    if (componentError) throw componentError;
    allComponents = (componentRows || []).map((row: any) => ({ ...row, weight: Number(row.weight) }));

    const componentIds = allComponents.map((row: any) => String(row.id));
    if (componentIds.length) {
      const { data: assignmentRows, error: assignmentError } = await db
        .from("grade_component_assessments")
        .select("component_id,assessment_id")
        .in("component_id", componentIds);
      if (assignmentError) throw assignmentError;
      allAssignmentRows = assignmentRows || [];
    }
  }

  const schemeById = new Map<string, any>(schemes.map((row: any) => [String(row.id), row]));
  const componentById = new Map<string, any>(allComponents.map((row: any) => [String(row.id), row]));
  const assignmentContexts: Record<string, any> = {};
  for (const row of allAssignmentRows) {
    const component = componentById.get(String(row.component_id));
    const scheme = component ? schemeById.get(String(component.scheme_id)) : null;
    if (!component || !scheme) continue;
    assignmentContexts[String(row.assessment_id)] = {
      componentId: String(component.id),
      componentName: String(component.name || "Component"),
      schemeId: String(scheme.id),
      gradingPeriod: String(scheme.grading_period || "prelim"),
      trackKey: String(scheme.track_key || "overall"),
      trackName: String(scheme.track_name || "Subject grade"),
    };
  }

  const components = selectedScheme
    ? allComponents.filter((row: any) => String(row.scheme_id) === String(selectedScheme.id))
    : [];
  const currentComponentIds = new Set(components.map((row: any) => String(row.id)));
  const assignments: Record<string, string> = {};
  for (const row of allAssignmentRows) {
    if (currentComponentIds.has(String(row.component_id))) {
      assignments[String(row.assessment_id)] = String(row.component_id);
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

  const trackConfigs = periodSchemes.map((scheme: any) => {
    const trackComponents = allComponents.filter((row: any) => String(row.scheme_id) === String(scheme.id));
    const trackComponentIds = new Set(trackComponents.map((row: any) => String(row.id)));
    const trackAssignments: Record<string, string> = {};
    for (const row of allAssignmentRows) {
      if (trackComponentIds.has(String(row.component_id))) {
        trackAssignments[String(row.assessment_id)] = String(row.component_id);
      }
    }
    return {
      scheme,
      components: trackComponents.map((row: any) => ({
        id: String(row.id),
        name: String(row.name),
        weight: Number(row.weight) || 0,
        parentComponentId: row.parent_component_id ? String(row.parent_component_id) : null,
      })),
      assessments: assessmentRows
        .filter((row: any) => trackAssignments[String(row.id)])
        .map((row: any) => ({
          id: String(row.id),
          title: String(row.title || "Assessment"),
          totalScore: Number(row.total_score) || 0,
          componentId: trackAssignments[String(row.id)],
        })),
    };
  });

  const trackWeightTotal = periodSchemes.reduce((sum: number, row: any) => sum + (Number(row.subject_weight) || 0), 0);
  const trackWeightsValid = periodSchemes.length > 0
    && periodSchemes.every((row: any) => Number(row.subject_weight) > 0)
    && Math.abs(trackWeightTotal - 100) < 0.001;

  let releaseStatus = { releasedCount: 0, releasedAt: null as string | null, studentIds: [] as string[] };
  const { data: releasedRows, error: releasedError } = await db
    .from("released_subject_term_grades")
    .select("student_id,released_at")
    .eq("owner_id", ownerId)
    .eq("subject_id", subjectId)
    .eq("grading_period", period)
    .order("released_at", { ascending: false });
  if (releasedError) throw releasedError;
  const releaseRows = releasedRows || [];
  releaseStatus = {
    releasedCount: releaseRows.length,
    releasedAt: releaseRows.length ? String(releaseRows[0].released_at || "") || null : null,
    studentIds: releaseRows.map((row: any) => String(row.student_id || "")).filter(Boolean),
  };

  const finalRoundingDigits = Number(periodSchemes[0]?.rounding_digits || 0);
  const preview = Array.from(studentMap.entries()).map(([studentId, student]) => {
    const trackGrades = trackConfigs.map((config: any) => {
      const calculation = calculateTermGrade({
        components: config.components,
        assessments: config.assessments,
        scores: scoresByStudent.get(studentId) || [],
        roundingDigits: Number(config.scheme.rounding_digits || 0),
      });
      return {
        trackKey: String(config.scheme.track_key || "overall"),
        name: String(config.scheme.track_name || "Subject grade"),
        weight: Number(config.scheme.subject_weight) || 0,
        complete: calculation.complete,
        rawPercentage: calculation.rawPercentage,
        termGrade: calculation.termGrade,
        missingCount: calculation.missingAssessmentIds.length,
        components: calculation.components,
      };
    });

    const combined = calculateWeightedTermGrade({
      grades: trackGrades.map((track: any) => ({
        key: track.trackKey,
        name: track.name,
        weight: track.weight,
        complete: track.complete,
        rawPercentage: track.rawPercentage,
        termGrade: track.termGrade,
      })),
      roundingDigits: finalRoundingDigits,
    });
    const selectedTrack = trackGrades.find((track: any) => track.trackKey === String(selectedScheme?.track_key || requestedTrackKey || "overall"))
      || trackGrades[0]
      || null;
    const breakdown = trackGrades.map((track: any) => ({
      kind: "grade_type",
      trackKey: track.trackKey,
      name: track.name,
      weight: track.weight,
      componentGrade: track.termGrade,
      contribution: track.termGrade == null ? null : track.termGrade * (track.weight / 100),
      components: track.components,
      subcomponents: track.components,
    }));

    return {
      studentId,
      name: studentLabel(student, studentId),
      codeName: String(student?.code_name || student?.preferred_code || "") || null,
      complete: combined.complete,
      rawPercentage: combined.rawPercentage,
      termGrade: combined.termGrade,
      missingCount: trackGrades.reduce((sum: number, track: any) => sum + track.missingCount, 0),
      components: selectedTrack?.components || [],
      trackGrades,
      breakdown,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return {
    subjects: subjects || [],
    subject,
    assessments: assessmentRows,
    gradingPeriod: period,
    tracks: periodSchemes.map((row: any) => ({
      id: String(row.id),
      trackKey: String(row.track_key || "overall"),
      name: String(row.track_name || "Subject grade"),
      sortOrder: Number(row.track_sort_order) || 0,
      weight: Number(row.subject_weight) || 0,
      roundingDigits: Number(row.rounding_digits) || 0,
    })),
    trackWeightTotal,
    trackWeightsValid,
    scheme: selectedScheme,
    components,
    assignments,
    assignmentContexts,
    preview,
    releaseStatus,
  };
}

export async function GET(request: Request) {
  const user = await getGradeAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(request.url);
    const subjectId = String(url.searchParams.get("subjectId") || "").trim();
    const gradingPeriod = normalizePeriod(url.searchParams.get("gradingPeriod"));
    const trackKey = String(url.searchParams.get("trackKey") || "").trim();
    const data = await loadWorkspace(user.id, subjectId || undefined, gradingPeriod, trackKey || undefined);
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
    const gradingPeriod = normalizePeriod(body?.gradingPeriod);
    const trackKey = String(body?.trackKey || "overall").trim() || "overall";
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

    if (action === "create_track") {
      const name = String(body?.trackName || "").trim();
      if (!name) return NextResponse.json({ error: "Enter a grade track name." }, { status: 400 });
      const { data: existing, error: existingError } = await db
        .from("grade_schemes")
        .select("id,track_sort_order")
        .eq("owner_id", user.id)
        .eq("subject_id", subjectId)
        .eq("grading_period", gradingPeriod)
        .order("track_sort_order", { ascending: true });
      if (existingError) throw existingError;

      const nextSortOrder = existing?.length ? Math.max(...existing.map((row: any) => Number(row.track_sort_order) || 0)) + 1 : 0;
      const nextTrackKey = randomUUID();
      const countAfterInsert = (existing?.length || 0) + 1;
      const equalWeight = Number((100 / countAfterInsert).toFixed(3));
      const newTrackWeight = Number((100 - equalWeight * (countAfterInsert - 1)).toFixed(3));

      const { data: inserted, error } = await db.from("grade_schemes").insert({
        owner_id: user.id,
        subject_id: subjectId,
        name: "Term Grade",
        rounding_digits: 0,
        grading_period: gradingPeriod,
        track_key: nextTrackKey,
        track_name: name,
        track_sort_order: nextSortOrder,
        subject_weight: newTrackWeight,
      }).select("id").single();
      if (error) throw error;

      if (existing?.length) {
        const { error: rebalanceError } = await db
          .from("grade_schemes")
          .update({ subject_weight: equalWeight, updated_at: new Date().toISOString() })
          .in("id", existing.map((row: any) => String(row.id)));
        if (rebalanceError) throw rebalanceError;
      }

      revalidatePath("/admin/grades");
      return NextResponse.json({ ok: true, trackKey: nextTrackKey, schemeId: String(inserted.id) });
    }

    if (action === "delete_track") {
      const { data: scheme, error: schemeError } = await db
        .from("grade_schemes")
        .select("id")
        .eq("owner_id", user.id)
        .eq("subject_id", subjectId)
        .eq("grading_period", gradingPeriod)
        .eq("track_key", trackKey)
        .maybeSingle();
      if (schemeError) throw schemeError;
      if (!scheme) return NextResponse.json({ error: "Grade track not found." }, { status: 404 });

      const [{ data: releasedCombined, error: combinedReleaseError }, { data: releasedLegacy, error: legacyReleaseError }] = await Promise.all([
        db.from("released_subject_term_grades")
          .select("id")
          .eq("owner_id", user.id)
          .eq("subject_id", subjectId)
          .eq("grading_period", gradingPeriod)
          .limit(1),
        db.from("released_term_grades").select("id").eq("scheme_id", scheme.id).limit(1),
      ]);
      if (combinedReleaseError) throw combinedReleaseError;
      if (legacyReleaseError) throw legacyReleaseError;
      if (releasedCombined?.length || releasedLegacy?.length) {
        return NextResponse.json({ error: "This grading period already has released grades and its grade types cannot be deleted." }, { status: 400 });
      }

      const { error } = await db.from("grade_schemes").delete().eq("id", scheme.id).eq("owner_id", user.id);
      if (error) throw error;

      const { data: remaining, error: remainingError } = await db
        .from("grade_schemes")
        .select("id,subject_weight")
        .eq("owner_id", user.id)
        .eq("subject_id", subjectId)
        .eq("grading_period", gradingPeriod)
        .order("track_sort_order", { ascending: true });
      if (remainingError) throw remainingError;

      if (remaining?.length === 1) {
        const { error: normalizeError } = await db.from("grade_schemes")
          .update({ subject_weight: 100, updated_at: new Date().toISOString() })
          .eq("id", remaining[0].id);
        if (normalizeError) throw normalizeError;
      } else if ((remaining?.length || 0) > 1) {
        const currentTotal = remaining.reduce((sum: number, row: any) => sum + (Number(row.subject_weight) || 0), 0);
        const basis = currentTotal > 0 ? remaining.map((row: any) => (Number(row.subject_weight) || 0) / currentTotal) : remaining.map(() => 1 / remaining.length);
        let assigned = 0;
        for (let index = 0; index < remaining.length; index += 1) {
          const weight = index === remaining.length - 1
            ? Number((100 - assigned).toFixed(3))
            : Number((basis[index] * 100).toFixed(3));
          assigned += weight;
          const { error: normalizeError } = await db.from("grade_schemes")
            .update({ subject_weight: weight, updated_at: new Date().toISOString() })
            .eq("id", remaining[index].id);
          if (normalizeError) throw normalizeError;
        }
      }

      revalidatePath("/admin/grades");
      return NextResponse.json({ ok: true });
    }

    if (action === "save_track_weights") {
      const rawWeights: any[] = Array.isArray(body?.trackWeights) ? body.trackWeights : [];
      const { data: periodSchemes, error: periodSchemesError } = await db
        .from("grade_schemes")
        .select("id,track_key")
        .eq("owner_id", user.id)
        .eq("subject_id", subjectId)
        .eq("grading_period", gradingPeriod)
        .order("track_sort_order", { ascending: true });
      if (periodSchemesError) throw periodSchemesError;
      if (!periodSchemes?.length) return NextResponse.json({ error: "Save the grade types first." }, { status: 400 });

      const weightByTrack = new Map(rawWeights.map((row: any) => [String(row?.trackKey || ""), Number(row?.weight)]));
      const normalized = periodSchemes.map((row: any) => ({
        id: String(row.id),
        trackKey: String(row.track_key || "overall"),
        weight: weightByTrack.get(String(row.track_key || "overall")),
      }));
      if (normalized.some((row: any) => !Number.isFinite(row.weight) || Number(row.weight) <= 0 || Number(row.weight) > 100)) {
        return NextResponse.json({ error: "Every grade type needs a weight greater than 0% and no more than 100%." }, { status: 400 });
      }
      const total = normalized.reduce((sum: number, row: any) => sum + Number(row.weight), 0);
      if (Math.abs(total - 100) > 0.001) {
        return NextResponse.json({ error: `Grade type weights must total exactly 100%. Current total: ${total.toFixed(2)}%.` }, { status: 400 });
      }

      const now = new Date().toISOString();
      for (const row of normalized) {
        const { error } = await db.from("grade_schemes")
          .update({ subject_weight: Number(row.weight), updated_at: now })
          .eq("id", row.id)
          .eq("owner_id", user.id);
        if (error) throw error;
      }

      revalidatePath("/admin/grades");
      return NextResponse.json({ ok: true });
    }

    if (action === "save_config") {
      const rawComponents: any[] = Array.isArray(body?.components) ? body.components : [];
      const components = rawComponents.map((row: any, index: number) => ({
        clientKey: String(row?.clientKey || `component-${index}`),
        name: String(row?.name || "").trim(),
        weight: Number(row?.weight),
        sortOrder: index,
        subcomponents: (Array.isArray(row?.subcomponents) ? row.subcomponents : []).map((child: any, childIndex: number) => ({
          clientKey: String(child?.clientKey || `component-${index}-sub-${childIndex}`),
          name: String(child?.name || "").trim(),
          weight: Number(child?.weight),
          sortOrder: childIndex,
        })),
      }));
      if (!components.length || components.some((row: any) => !row.name || !Number.isFinite(row.weight) || row.weight <= 0)) {
        return NextResponse.json({ error: "Every component needs a name and a positive weight." }, { status: 400 });
      }
      const totalWeight = components.reduce((sum: number, row: any) => sum + row.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.001) {
        return NextResponse.json({ error: `Top-level component weights must total exactly 100%. Current total: ${totalWeight.toFixed(2)}%.` }, { status: 400 });
      }
      for (const component of components) {
        if (!component.subcomponents.length) continue;
        if (component.subcomponents.some((child: any) => !child.name || !Number.isFinite(child.weight) || child.weight <= 0)) {
          return NextResponse.json({ error: `Every subcomponent under ${component.name} needs a name and positive weight.` }, { status: 400 });
        }
        const childTotal = component.subcomponents.reduce((sum: number, child: any) => sum + child.weight, 0);
        if (Math.abs(childTotal - 100) > 0.001) {
          return NextResponse.json({ error: `Subcomponents under ${component.name} must total exactly 100%. Current total: ${childTotal.toFixed(2)}%.` }, { status: 400 });
        }
      }

      const roundingDigits = Math.min(2, Math.max(0, Math.trunc(Number(body?.roundingDigits) || 0)));
      const trackName = String(body?.trackName || "Subject grade").trim() || "Subject grade";
      const assignments: Array<{ assessmentId: string; componentKey: string }> = Array.isArray(body?.assignments)
        ? body.assignments.map((row: any) => ({
            assessmentId: String(row?.assessmentId || "").trim(),
            componentKey: String(row?.componentKey || "").trim(),
          })).filter((row: any) => row.assessmentId && row.componentKey)
        : [];

      const leafKeys = new Set<string>();
      for (const component of components) {
        if (component.subcomponents.length) {
          component.subcomponents.forEach((child: any) => leafKeys.add(child.clientKey));
        } else {
          leafKeys.add(component.clientKey);
        }
      }
      if (assignments.some((row) => !leafKeys.has(row.componentKey))) {
        return NextResponse.json({ error: "Assessments can only be assigned to a component without subcomponents, or directly to a subcomponent." }, { status: 400 });
      }

      const assessmentIds = Array.from(new Set(assignments.map((row) => row.assessmentId)));
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
        .eq("grading_period", gradingPeriod)
        .eq("track_key", trackKey)
        .maybeSingle();
      if (existingError) throw existingError;

      let schemeId = String(existingScheme?.id || "");
      if (schemeId) {
        const { error } = await db.from("grade_schemes").update({
          rounding_digits: roundingDigits,
          track_name: trackName,
          updated_at: new Date().toISOString(),
        }).eq("id", schemeId).eq("owner_id", user.id);
        if (error) throw error;
        const { error: deleteError } = await db.from("grade_components").delete().eq("scheme_id", schemeId);
        if (deleteError) throw deleteError;
      } else {
        const { data: siblingTracks, error: siblingError } = await db
          .from("grade_schemes")
          .select("track_sort_order")
          .eq("owner_id", user.id)
          .eq("subject_id", subjectId)
          .eq("grading_period", gradingPeriod)
          .order("track_sort_order", { ascending: false })
          .limit(1);
        if (siblingError) throw siblingError;
        const nextSortOrder = siblingTracks?.length ? Number(siblingTracks[0].track_sort_order) + 1 : 0;
        const { data: insertedScheme, error } = await db.from("grade_schemes").insert({
          owner_id: user.id,
          subject_id: subjectId,
          name: "Term Grade",
          rounding_digits: roundingDigits,
          grading_period: gradingPeriod,
          track_key: trackKey,
          track_name: trackName,
          track_sort_order: nextSortOrder,
        }).select("id").single();
        if (error) throw error;
        schemeId = String(insertedScheme.id);
      }

      const parentRows = components.map((row: any, index: number) => ({
        scheme_id: schemeId,
        name: row.name,
        weight: row.weight,
        sort_order: index * 10000,
        parent_component_id: null,
      }));
      const { data: insertedParents, error: parentInsertError } = await db.from("grade_components").insert(parentRows).select("id,sort_order");
      if (parentInsertError) throw parentInsertError;
      const parentIdByOrder = new Map<number, string>((insertedParents || []).map((row: any) => [Number(row.sort_order), String(row.id)] as [number, string]));
      const componentIdByKey = new Map<string, string>();
      components.forEach((row: any, index: number) => componentIdByKey.set(row.clientKey, parentIdByOrder.get(index * 10000) || ""));

      const childRows: any[] = [];
      const childKeyByOrder = new Map<number, string>();
      components.forEach((component: any, parentIndex: number) => {
        const parentId = componentIdByKey.get(component.clientKey) || "";
        component.subcomponents.forEach((child: any, childIndex: number) => {
          const sortOrder = parentIndex * 10000 + childIndex + 1;
          childRows.push({
            scheme_id: schemeId,
            name: child.name,
            weight: child.weight,
            sort_order: sortOrder,
            parent_component_id: parentId,
          });
          childKeyByOrder.set(sortOrder, child.clientKey);
        });
      });
      if (childRows.length) {
        const { data: insertedChildren, error: childInsertError } = await db.from("grade_components").insert(childRows).select("id,sort_order");
        if (childInsertError) throw childInsertError;
        for (const row of insertedChildren || []) {
          const key = childKeyByOrder.get(Number(row.sort_order));
          if (key) componentIdByKey.set(key, String(row.id));
        }
      }

      if (assessmentIds.length) {
        const { error } = await db.from("grade_component_assessments").delete().in("assessment_id", assessmentIds);
        if (error) throw error;
      }
      const assignmentRows = assignments
        .map((row) => ({ component_id: componentIdByKey.get(row.componentKey), assessment_id: row.assessmentId }))
        .filter((row) => row.component_id);
      if (assignmentRows.length) {
        const { error } = await db.from("grade_component_assessments").insert(assignmentRows);
        if (error) throw error;
      }

      revalidatePath("/admin/grades");
      return NextResponse.json({ ok: true, schemeId });
    }

    if (action === "release") {
      const workspace: any = await loadWorkspace(user.id, subjectId, gradingPeriod, trackKey);
      if (!workspace.tracks?.length) return NextResponse.json({ error: "Save the grading structure first." }, { status: 400 });
      if (!workspace.trackWeightsValid) {
        return NextResponse.json({ error: "Grade type weights must total 100% before releasing the final subject grade." }, { status: 400 });
      }

      const allReady = (workspace.preview || []).filter((row: any) => row.complete && row.termGrade != null && row.rawPercentage != null);
      if (!allReady.length) return NextResponse.json({ error: "No student grades are ready to release." }, { status: 400 });

      const requestedIds: string[] = Array.isArray(body?.studentIds)
        ? Array.from(new Set<string>(body.studentIds.map((value: any) => String(value || "").trim()).filter(Boolean)))
        : allReady.map((row: any) => String(row.studentId));
      if (!requestedIds.length) return NextResponse.json({ error: "Select at least one student to release." }, { status: 400 });

      const readyById = new Map(allReady.map((row: any) => [String(row.studentId), row]));
      const invalidIds = requestedIds.filter((studentId) => !readyById.has(studentId));
      if (invalidIds.length) {
        return NextResponse.json({ error: "One or more selected students do not have a complete final grade yet." }, { status: 400 });
      }
      const ready = requestedIds.map((studentId) => readyById.get(studentId));

      const now = new Date().toISOString();
      const roundingDigits = Number(workspace.tracks?.[0]?.roundingDigits ?? workspace.scheme?.rounding_digits ?? 0);
      const rows = ready.map((row: any) => ({
        owner_id: user.id,
        subject_id: subjectId,
        grading_period: gradingPeriod,
        student_id: row.studentId,
        raw_percentage: row.rawPercentage,
        term_grade: row.termGrade,
        rounding_digits: roundingDigits,
        breakdown: row.breakdown,
        released_at: now,
        updated_at: now,
      }));

      const { error: historyError } = await db.from("subject_term_grade_release_history").insert(ready.map((row: any) => ({
        owner_id: user.id,
        subject_id: subjectId,
        grading_period: gradingPeriod,
        student_id: row.studentId,
        raw_percentage: row.rawPercentage,
        term_grade: row.termGrade,
        rounding_digits: roundingDigits,
        breakdown: row.breakdown,
        released_at: now,
        released_by: user.id,
      })));
      if (historyError) throw historyError;

      const { error } = await db
        .from("released_subject_term_grades")
        .upsert(rows, { onConflict: "owner_id,subject_id,grading_period,student_id" });
      if (error) throw error;

      const periodLabel = gradingPeriod === "prelim" ? "Prelim" : gradingPeriod === "midterm" ? "Midterm" : "Finals";
      const releaseContext = `${subject.name} · ${periodLabel}`;
      await sendTermGradeReleasePush(
        ready.map((row: any) => String(row.studentId)),
        user.id,
        releaseContext,
        `${subjectId}-${gradingPeriod}`,
        now,
      );

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
