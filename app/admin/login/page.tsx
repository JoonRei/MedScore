import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { getAdminUser } from "@/lib/admin-auth";

export default async function AdminLoginPage() {
  const admin = await getAdminUser();
  if (admin) redirect("/admin");

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-brand"><span className="login-brand-mark">M</span> MedScores</div>
        <div className="login-message">
          <div className="kicker">Administrator</div>
          <h1>Manage results without exposing student records.</h1>
          <p>Create subjects and assessments, encode scores, control publication and manage private student access from one workspace.</p>
        </div>
        <div className="login-visual-footer">College of Medicine · Administrative Workspace</div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <h2>Admin sign in</h2>
          <p>Sign in using the administrator account you created under Supabase Authentication → Users.</p>
          <AdminLoginForm />
          <div className="login-meta"><span>Secure administrative access</span><Link href="/">Student Portal</Link></div>
        </div>
      </section>
    </div>
  );
}
