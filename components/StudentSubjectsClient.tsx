"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { EmptyState } from "@/components/EmptyState";
import { StudentFilterMenu } from "@/components/StudentFilterMenu";

export type StudentSubjectRow = { id: string; name: string; code: string | null; term: string; academicYear: string };

export function StudentSubjectsClient({ subjects }: { subjects: StudentSubjectRow[] }) {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("all");

  const terms = useMemo(
    () => [
      { value: "all", label: "All terms" },
      ...Array.from(new Set(subjects.map((item) => item.term)))
        .sort()
        .map((value) => ({ value, label: value })),
    ],
    [subjects]
  );

  const filtered = useMemo(() => subjects.filter((item) => {
    const q = query.trim().toLowerCase();
    return (!q || `${item.name} ${item.code || ""} ${item.academicYear}`.toLowerCase().includes(q)) && (term === "all" || item.term === term);
  }), [subjects, query, term]);

  if (!subjects.length) {
    return <EmptyState title="No subjects assigned" description="Your enrolled subjects will appear here." />;
  }

  return <>
    <div className="subject-toolbar-v453">
      <div className="search-box subject-search-v453">
        <SearchIcon size={18} />
        <input
          className="input"
          placeholder="Search subjects"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="subject-filter-slot-v453">
        <StudentFilterMenu value={term} onChange={setTerm} options={terms} label="Filter by term" />
      </div>
    </div>

    <div className="subject-list-v453">
      {filtered.map((subject) => (
        <Link className="subject-card-v453" href={`/student/subjects/${subject.id}`} key={subject.id}>
          <div className="subject-card-v453-copy">
            <div className="subject-card-v453-meta">
              {subject.code && <strong>{subject.code}</strong>}
              <span>{subject.term}</span>
            </div>
            <h3>{subject.name}</h3>
            <p>Academic year {subject.academicYear}</p>
          </div>

        </Link>
      ))}
      {!filtered.length && (
        <div className="subject-empty-state">
          <EmptyState title="No matching subjects" description="Try another search or term." />
        </div>
      )}
    </div>
  </>;
}
