import Link from "next/link";

export function BrandLogo({ className = "" }: { className?: string }) {
  return <img src="/logo.png" alt="" aria-hidden="true" className={`brand-logo ${className}`.trim()} />;
}

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="brand">
      <BrandLogo />
      {!compact && (
        <span className="brand-copy">
          <strong>MedScores</strong>
          <small>College of Medicine</small>
        </span>
      )}
    </Link>
  );
}
