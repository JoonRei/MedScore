import { AdminTermGradesWorkspace } from "@/components/AdminTermGradesWorkspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <>
      <header className="page-header grades-page-header-v424">
        <div>
          <span className="eyebrow">Academic grading</span>
          <h1>Term Grades</h1>
          <p>Configure component weights, review computed term grades, and release them separately from assessment scores.</p>
        </div>
      </header>
      <AdminTermGradesWorkspace />
    </>
  );
}
