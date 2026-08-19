import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminWorkspaceContext } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { YEAR_LEVELS } from "@/lib/constants";
import { normalizeCodeName } from "@/lib/utils";

type ImportRow = {
  rowNumber?: number;
  name?: unknown;
  studentNumber?: unknown;
  codeName?: unknown;
  yearLevel?: unknown;
  pin?: unknown;
};


function normalizeYearLevel(value: string) {
  const compact = value.trim().toLowerCase().replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
    "1": "1st Year", "1st": "1st Year", "1st year": "1st Year", "year 1": "1st Year",
    "2": "2nd Year", "2nd": "2nd Year", "2nd year": "2nd Year", "year 2": "2nd Year",
    "3": "3rd Year", "3rd": "3rd Year", "3rd year": "3rd Year", "year 3": "3rd Year",
    "4": "4th Year", "4th": "4th Year", "4th year": "4th Year", "year 4": "4th Year",
  };
  return aliases[compact] || value.trim();
}

function splitName(value: string) {
  const name = value.replace(/\s+/g, " ").trim();
  if (!name) return null;
  if (name.includes(",")) {
    const [last, ...rest] = name.split(",");
    const first = rest.join(",").trim();
    if (!last.trim() || !first) return null;
    return { firstName: first, lastName: last.trim() };
  }
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1)! };
}

export async function POST(request: Request) {
  const context = await getAdminWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.period) return NextResponse.json({ error: "Choose an active semester first." }, { status: 400 });

  try {
    const body = await request.json();
    const rawRows = Array.isArray(body.rows) ? (body.rows as ImportRow[]).slice(0, 500) : [];
    if (!rawRows.length) return NextResponse.json({ error: "Paste at least one student row." }, { status: 400 });

    const db = createAdminClient();
    const issues: Array<{ row: number; message: string }> = [];
    let created = 0;
    let carried = 0;
    let alreadyIncluded = 0;

    const seenNumbers = new Set<string>();
    const seenCodes = new Set<string>();

    for (let index = 0; index < rawRows.length; index += 1) {
      const item = rawRows[index];
      const rowNumber = Number(item.rowNumber) || index + 1;
      const parsedName = splitName(String(item.name || ""));
      const studentNumber = String(item.studentNumber || "").trim();
      const codeName = normalizeCodeName(String(item.codeName || ""));
      const yearLevel = normalizeYearLevel(String(item.yearLevel || ""));
      const pin = String(item.pin || "").trim();

      if (!parsedName) { issues.push({ row: rowNumber, message: "Name must include first and last name." }); continue; }
      if (!studentNumber) { issues.push({ row: rowNumber, message: "ID number is required." }); continue; }
      if (!/^[A-Za-z0-9_-]{4,30}$/.test(codeName)) { issues.push({ row: rowNumber, message: "Preferred code must be 4–30 letters, numbers, hyphens or underscores." }); continue; }
      if (!(YEAR_LEVELS as readonly string[]).includes(yearLevel)) { issues.push({ row: rowNumber, message: "Year level is not recognized." }); continue; }
      if (!/^\d{4,6}$/.test(pin)) { issues.push({ row: rowNumber, message: "Initial PIN must contain 4–6 digits." }); continue; }

      const normalizedNumber = studentNumber.toLowerCase();
      const normalizedCode = codeName.toLowerCase();
      if (seenNumbers.has(normalizedNumber) || seenCodes.has(normalizedCode)) {
        issues.push({ row: rowNumber, message: "Duplicate ID number or preferred code in the pasted rows." });
        continue;
      }
      seenNumbers.add(normalizedNumber);
      seenCodes.add(normalizedCode);

      const [{ data: byNumber, error: numberError }, { data: byCode, error: codeError }] = await Promise.all([
        db.from("students").select("id,student_number,code_name,owner_id").eq("owner_id", context.workspace.id).eq("student_number", studentNumber).maybeSingle(),
        db.from("students").select("id,student_number,code_name,owner_id").eq("owner_id", context.workspace.id).eq("code_name", codeName).maybeSingle(),
      ]);
      if (numberError || codeError) throw numberError || codeError;
      const existingRows = [byNumber, byCode].filter(Boolean).filter((student: any, index, list) => list.findIndex((item: any) => item.id === student.id) === index);

      if (existingRows.length) {
        const exact = existingRows.find((student: any) =>
          String(student.student_number || "").toLowerCase() === normalizedNumber &&
          String(student.code_name || "").toLowerCase() === normalizedCode
        );
        if (!exact) {
          issues.push({ row: rowNumber, message: "ID number or preferred code already belongs to another student." });
          continue;
        }

        const { data: membership } = await db
          .from("student_period_memberships")
          .select("student_id")
          .eq("student_id", exact.id)
          .eq("period_id", context.period.id)
          .maybeSingle();
        if (membership) {
          alreadyIncluded += 1;
          continue;
        }

        const { error: membershipError } = await db
          .from("student_period_memberships")
          .insert({ student_id: exact.id, period_id: context.period.id, year_level: yearLevel });
        if (membershipError) throw membershipError;
        await db.from("students").update({ year_level: yearLevel }).eq("id", exact.id).eq("owner_id", context.workspace.id);
        carried += 1;
        continue;
      }

      const pinHash = await bcrypt.hash(pin, 12);
      const { data: student, error: insertError } = await db
        .from("students")
        .insert({
          owner_id: context.workspace.id,
          first_name: parsedName.firstName,
          last_name: parsedName.lastName,
          student_number: studentNumber,
          code_name: codeName,
          pin_hash: pinHash,
          year_level: yearLevel,
        })
        .select("id")
        .single();
      if (insertError) {
        if (insertError.code === "23505") {
          issues.push({ row: rowNumber, message: "ID number or preferred code is already in use." });
          continue;
        }
        throw insertError;
      }

      const { error: membershipError } = await db
        .from("student_period_memberships")
        .insert({ student_id: student.id, period_id: context.period.id, year_level: yearLevel });
      if (membershipError) {
        await db.from("students").delete().eq("id", student.id).eq("owner_id", context.workspace.id);
        throw membershipError;
      }
      created += 1;
    }

    return NextResponse.json({ ok: true, created, carried, alreadyIncluded, issues });
  } catch {
    return NextResponse.json({ error: "Unable to import the pasted students." }, { status: 500 });
  }
}
