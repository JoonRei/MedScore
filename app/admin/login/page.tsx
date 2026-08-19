import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { BrandLogo } from "@/components/Brand";
import { getAdminUser } from "@/lib/admin-auth";

export default async function AdminLoginPage() {
  const admin = await getAdminUser();
  if (admin) redirect("/admin");

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-brand"><BrandLogo className="login-logo" /><span>MedScores</span></div>
        <div className="login-message">
          <div className="kicker">Administrator</div>
          <h1>Manage academic records with controlled access.</h1>
          <p>Create subjects and assessments, encode scores, control score availability and manage student access from your Admin account.</p>
        </div>
        <div className="login-visual-footer">College of Medicine · Administrative Workspace</div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-brand"><BrandLogo /><span><strong>MedScores</strong><small>College of Medicine</small></span></div>
          <h2>Admin sign in</h2>
          <p>Use your MedScores user account.</p>
          <AdminLoginForm />
          <div className="login-meta"><span>Administrative access</span><Link href="/">Student Portal</Link></div>
        </div>
      </section>
    </div>
  );
}
