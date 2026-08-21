# MedScores V4.22 Setup

V4.22 uses the same push-subscription table introduced in V4.21. If you already completed V4.21 setup, there is no new database migration.

## Required Web Push setup

The following file must have been run once:

```text
database/v4.21_student_push_notifications.sql
```

Install dependencies:

```powershell
npm install
```

Create Web Push keys once if you have not already:

```powershell
npx web-push generate-vapid-keys
```

Add the values to `.env.local` and to the deployed project environment:

```text
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:your-email@example.com
```

Never expose the private key through a `NEXT_PUBLIC_` variable.

## Verify a phone/device notification

1. Open **Student → Settings → Phone notifications**.
2. Choose **Enable notifications**.
3. MedScores immediately sends a real Web Push test.
4. You can also use **Send test notification** any time while the device is connected.
5. Release an assessment from Admin and confirm the score alert appears in the device notification system.

On iPhone/iPad, MedScores must be installed on the Home Screen before Web Push can be enabled. Permission must be requested from the student's direct button tap.

Run locally:

```powershell
npm run dev
```
