import Link from "next/link";
import { redirect } from "next/navigation";
import { StudentLoginForm } from "@/components/StudentLoginForm";
import { BrandLogo } from "@/components/Brand";
import { getStudentSession } from "@/lib/student-session";

export default async function StudentLoginPage() {
  const session = await getStudentSession();
  if (session) redirect("/student");

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-brand"><BrandLogo className="login-logo" /><span>MedScores</span></div>
        <div className="login-message">
          <div className="kicker">College of Medicine</div>
          <h1>Your academic results, in one place.</h1>
          <p>View quizzes, examinations, pre-tests, post-tests and other available assessment scores using your assigned code name and PIN.</p>
        </div>
        <div className="login-visual-footer">Academic Performance Portal</div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-brand"><BrandLogo /><span><strong>MedScores</strong><small>College of Medicine</small></span></div>
          <h2>Student sign in</h2>
          <p>Enter the credentials assigned to your account.</p>
          <StudentLoginForm />
          <div className="login-meta"><span>Accounts are created by the administrator.</span><Link href="/admin/login">Admin Portal</Link></div>
        </div>
      </section>
    </div>
  );
}
