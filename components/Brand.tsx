import Link from "next/link";

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="brand">
      <span className="brand-mark">M</span>
      {!compact && (
        <span className="brand-copy">
          <strong>MedScores</strong>
          <small>College of Medicine</small>
        </span>
      )}
    </Link>
  );
}
