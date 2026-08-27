import { AdminTermGradesWorkspace } from "@/components/AdminTermGradesWorkspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <>
      <header className="page-header grades-page-header-v424">
        <div>
          <span className="eyebrow">Student grades</span>
          <h1>Term Grades</h1>
          <p>Set components, choose assessments, review student grades, and release them when ready.</p>
        </div>
      </header>
      <AdminTermGradesWorkspace />
    </>
  );
}
