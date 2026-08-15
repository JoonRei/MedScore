# MedScores V1.8 Setup

## 1. Install dependencies

V1.5 uses the official HugeIcons React packages, so run:

```powershell
npm install
```

## 2. Supabase database

If you already have MedScores working with the same database, **do not rerun the schema** for this update.

For a completely new MedScores database only, open Supabase **SQL Editor**, paste:

```text
supabase/schema.sql
```

and run it once.

## 3. Admin account

Under Supabase **Authentication > Users**, keep/create your administrator email and password. Students are not Supabase Auth users; create them from MedScores **Admin > Students**.

## 4. `.env.local`

Keep your existing working configuration. The Project URL must be the project base URL only:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxx
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxx
```

Do **not** append `/rest/v1` or `/auth/v1`.

Correct:

```text
https://abcdefghijklmnopqrst.supabase.co
```

Incorrect:

```text
https://abcdefghijklmnopqrst.supabase.co/rest/v1
https://abcdefghijklmnopqrst.supabase.co/auth/v1
```

Legacy key names remain supported by the existing MedScores Supabase configuration code.

## 5. Start

After copying your `.env.local` into this V1.8 folder:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run dev
```

Admin portal:

```text
http://localhost:3000/admin/login
```

Student portal:

```text
http://localhost:3000
```

## Inactivity security

Both portals automatically sign out after **15 minutes without activity**. A privacy warning appears during the final **60 seconds** and provides **Stay signed in** and **Sign out now** actions.

## Recommended workflow

1. Create Subjects.
2. Add Students and assign subjects.
3. Create an Assessment as Draft.
4. Enter or paste scores.
5. Review the entries.
6. Release the scores when they are ready.
7. Students see only released results through Code Name + PIN access.


## Logo
Replace `public/logo.png` with your own square PNG. Keep the filename `logo.png`; no code changes are needed. Commit and push the replacement and Vercel will use it for both the app logo and browser icon.

## Required Admin environment variable
Add `ADMIN_EMAIL` in `.env.local` and in Vercel Project Settings → Environment Variables. Use the exact email of the single Supabase Authentication user that should have Admin access.
