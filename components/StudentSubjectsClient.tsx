"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { EmptyState } from "@/components/EmptyState";

export type StudentSubjectRow = { id: string; name: string; code: string | null; term: string; academicYear: string };

export function StudentSubjectsClient({ subjects }: { subjects: StudentSubjectRow[] }) {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("all");
  const terms = useMemo(() => [{ value: "all", label: "All terms" }, ...Array.from(new Set(subjects.map((item) => item.term))).sort().map((value) => ({ value, label: value }))], [subjects]);
  const filtered = useMemo(() => subjects.filter((item) => {
    const q = query.trim().toLowerCase();
    return (!q || `${item.name} ${item.code || ""} ${item.academicYear}`.toLowerCase().includes(q)) && (term === "all" || item.term === term);
  }), [subjects, query, term]);

  if (!subjects.length) return <EmptyState title="No subjects assigned" description="Your enrolled subjects will appear here."/>;

  return <>
    <div className="subject-filterbar">
      <div className="search-box"><SearchIcon size={17}/><input className="input" placeholder="Search subjects" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <CustomSelect value={term} onChange={setTerm} options={terms} />
      <span>{filtered.length} subjects</span>
    </div>
    <div className="subject-list">
      {filtered.map((subject) => <Link className="subject-card" href={`/student/subjects/${subject.id}`} key={subject.id}>
        <div className="subject-card-top"><span className="subject-code">{(subject.code || subject.name).slice(0,3).toUpperCase()}</span></div>
        <h3>{subject.name}</h3><p>{subject.code || "College of Medicine"}</p>
        <div className="subject-card-bottom"><small>{subject.academicYear} · {subject.term}</small></div>
      </Link>)}
      {!filtered.length && <div className="subject-empty-state"><EmptyState title="No matching subjects" description="Try another search or term." /></div>}
    </div>
  </>;
}
