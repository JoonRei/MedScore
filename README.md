# MedScores V1.6

Private College of Medicine academic performance portal built with Next.js and Supabase.

## V1.5 — Reports, Results & Access Refinement

V1.5 keeps the working Supabase configuration and academic workflows while refining reports, student results, navigation actions, scroll behavior, release terminology, and server-side access protection.

### UI and UX changes

- Plus Jakarta Sans used consistently across Admin and Student portals
- Larger readable typography throughout navigation, forms, tables, modals, reports and student results
- Official HugeIcons React packages replace the previous hand-drawn SVG icon set
- Add/New buttons remain text-only; Manage is a clear text control while menu actions use concise HugeIcons where useful
- Cleaner desktop sidebar and horizontally scrollable mobile bottom navigation
- Simplified panels and flat internal sections to avoid unnecessary containers inside containers
- Rebuilt modal layout with fixed header/footer and a scrolling form body
- Custom searchable dropdowns rendered in a document-level portal so they cannot be clipped; options no longer repeat selection icons
- Rebuilt custom date picker with responsive positioning and a mobile bottom-sheet layout
- Custom flat subject-selection rows; no native checkbox UI
- Responsive tables become structured mobile records instead of squeezed desktop tables
- Consistent buttons, status pills, feedback messages, inputs and spacing
- Scrollbars are visually hidden throughout the app while scroll behavior remains available
- Admin Reports rebuilt as a structured performance list instead of a nested card grid
- Student Results rebuilt as a readable responsive results table/list

### Security and behavior

- 15-minute inactivity auto logout for Admin and Student portals
- 60-second privacy warning before automatic logout
- Last activity is shared through browser storage so idle state persists across tabs/reopens in the same browser
- Student and Admin inactivity state are tracked separately
- Protected Admin pages verify authentication before privileged data access
- Protected Student pages verify the private student session before rendering
- Request-level route gates redirect unauthenticated users away from protected Admin/Student URLs
- Protected mutation APIs independently reject requests without a valid session

### Existing strong workflows retained

- Student Code Name + PIN access
- Admin-only Supabase authentication
- Students, subjects and enrollments
- Draft / Released / Archived assessments
- Score entry and validated bulk paste
- Reports and private student results
- Working Supabase project URL normalization from the previous fixes

See `SETUP.md` for installation and Supabase configuration.


## V1.6 refinements
- Preferred student code names preserve the exact capitalization entered by the administrator.
- Custom dropdowns use text-only triggers and options without decorative dropdown icons.
- Assessments can be filtered directly by subject for faster access.
- Existing authentication, inactivity logout, Supabase URL normalization, and protected routes remain unchanged.
