# MedScores V4.21 Setup

## 1. Apply the database update once

Run:

```text
database/v4.21_student_push_notifications.sql
```

This stores opt-in device notification subscriptions for students.

## 2. Install dependencies

```powershell
npm install
```

## 3. Create Web Push keys once

```powershell
npx web-push generate-vapid-keys
```

Add the generated values to `.env.local` and to the deployed project environment:

```text
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:your-email@example.com
```

Never put the private key in a `NEXT_PUBLIC_` variable.

## 4. Run MedScores

```powershell
npm run dev
```

Test with an Admin and Student session on separate devices. On the Student portal open **Notifications**, choose **Enable notifications**, then release an assessment from Admin.

On iPhone/iPad, install MedScores to the Home Screen before enabling device notifications. Permission must be requested by the student's button tap.

V4.21 keeps in-app live notifications as a fallback even when device push is unavailable or not enabled.
