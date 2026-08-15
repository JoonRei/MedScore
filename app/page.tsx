import Link from "next/link";
import { redirect } from "next/navigation";
import { StudentLoginForm } from "@/components/StudentLoginForm";
import { getStudentSession } from "@/lib/student-session";

export default async function StudentLoginPage() {
  const session = await getStudentSession();
  if (session) redirect("/student");

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-brand"><span className="login-brand-mark">M</span> MedScores</div>
        <div className="login-message">
          <div className="kicker">College of Medicine</div>
          <h1>Your academic results, kept private.</h1>
          <p>
            View quizzes, examinations, pre-tests, post-tests and other released assessment scores using only your assigned private code name and PIN.
          </p>
        </div>
        <div className="login-visual-footer">Private Academic Performance Portal</div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <h2>Student sign in</h2>
          <p>Use the private code name and PIN assigned to your account.</p>
          <StudentLoginForm />
          <div className="login-meta"><span>Accounts are created by the administrator.</span><Link href="/admin/login">Admin Portal</Link></div>
        </div>
      </section>
    </div>
  );
}
