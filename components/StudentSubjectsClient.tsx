"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { EmptyState } from "@/components/EmptyState";
import { StudentFilterMenu } from "@/components/StudentFilterMenu";

export type StudentSubjectRow = {
  id: string;
  name: string;
  code: string | null;
  term: string;
  academicYear: string;
};

export function StudentSubjectsClient({ subjects }: { subjects: StudentSubjectRow[] }) {
  const router = useRouter();
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return subjects.filter((item) => {
      const matchesQuery =
        !q ||
        `${item.name} ${item.code || ""} ${item.academicYear}`
          .toLowerCase()
          .includes(q);

      return matchesQuery && (term === "all" || item.term === term);
    });
  }, [subjects, query, term]);

  const prefetchSubject = (id: string) => {
    router.prefetch(`/student/subjects/${id}`);
  };

  // Warm the first visible subject routes shortly after the list is ready.
  // Next Link also prefetches, but this makes the common first taps feel quicker.
  useEffect(() => {
    if (!subjects.length) return;

    const timer = window.setTimeout(() => {
      subjects.slice(0, 8).forEach((subject) => {
        router.prefetch(`/student/subjects/${subject.id}`);
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [router, subjects]);

  if (!subjects.length) {
    return (
      <EmptyState
        title="No subjects assigned"
        description="Your enrolled subjects will appear here."
      />
    );
  }

  return (
    <>
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
          <StudentFilterMenu
            value={term}
            onChange={setTerm}
            options={terms}
            label="Filter by term"
          />
        </div>
      </div>

      <div className="subject-list-v453">
        {filtered.map((subject) => {
          const href = `/student/subjects/${subject.id}`;

          return (
            <Link
              className="subject-card-v453"
              href={href}
              key={subject.id}
              prefetch={true}
              onPointerEnter={() => prefetchSubject(subject.id)}
              onFocus={() => prefetchSubject(subject.id)}
              onTouchStart={() => prefetchSubject(subject.id)}
            >
              <div className="subject-card-v453-copy">
                <div className="subject-card-v453-meta">
                  {subject.code && <strong>{subject.code}</strong>}
                  <span>{subject.term}</span>
                </div>
                <h3>{subject.name}</h3>
                <p>Academic year {subject.academicYear}</p>
              </div>
            </Link>
          );
        })}

        {!filtered.length && (
          <div className="subject-empty-state">
            <EmptyState
              title="No matching subjects"
              description="Try another search or term."
            />
          </div>
        )}
      </div>
    </>
  );
}
