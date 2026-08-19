import type { SVGProps } from "react";

export function FingerprintMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M16 4.5C10.2 4.5 5.5 9.2 5.5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M26.5 15C26.5 9.2 21.8 4.5 16 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8.6 18.4V15.3C8.6 11.2 11.9 7.8 16 7.8C20.1 7.8 23.4 11.2 23.4 15.3V18.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M11.7 21.2V15.5C11.7 13.1 13.6 11.1 16 11.1C18.4 11.1 20.3 13.1 20.3 15.5V20.4C20.3 24 19.2 26.7 17.9 28.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M14.8 24.9V15.7C14.8 15 15.3 14.5 16 14.5C16.7 14.5 17.2 15 17.2 15.7V21.3C17.2 24.6 16.3 27 15.4 28.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8.6 22.6C9.2 25 10.3 27 11.7 28.7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M23.4 21.5C23 24.1 22 26.6 20.7 28.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M5.8 19.8C6.3 23.2 7.8 26.2 10 28.7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M26.2 19.7C25.8 23.2 24.5 26.2 22.4 28.7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
