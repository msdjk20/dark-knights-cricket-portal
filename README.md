# Dark Knights Cricket Portal

Mobile-first cricket availability and leave-management portal built with Next.js App Router and Supabase.

## Included
- Google OAuth sign-in through Supabase Auth (no SMS OTP required)
- Player and admin roles
- Match fixtures
- Player leave requests with reason and status
- Admin approval/rejection with decision notes
- Shared PostgreSQL database with Row Level Security (RLS)
- Realtime refresh support can be enabled for `leave_requests`

## Prerequisites
- Node.js 20+
- A Supabase project
- A Google Cloud OAuth web client configured in Supabase Auth
- A deployment account such as Vercel

## 1. Configure Supabase
1. Create a Supabase project.
2. In Google Cloud, create an OAuth **Web application** client. Set its authorized redirect URI to `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
3. In **Authentication → Sign In / Providers → Google**, enable Google and paste the Google Client ID and Client Secret.
4. In **Authentication → URL Configuration**, set the Site URL and allow `http://localhost:3000/auth/callback` plus your eventual production callback URL (`https://YOUR_SITE/auth/callback`).
5. Open **SQL Editor** and run `supabase/schema.sql` if you have not already done so.
6. In **Project Settings → API**, copy the Project URL and anon/publishable key.

## 2. Configure the app
Copy `.env.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Then install and run:
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## 3. Create the first admin safely
By default, new users are players. Sign in with the admin's Google account once, then find that user's UUID in **Supabase → Authentication → Users**. Run this in SQL Editor, replacing the UUID:
```sql
update public.profiles
set role = 'admin'
where id = 'REPLACE-WITH-AUTH-USER-UUID';
```
Do not expose the Supabase service-role key in the browser or commit it to source control.

## 4. Deploy online
1. Push this folder to a private/public Git repository.
2. Import the repository into Vercel.
3. Add the two `NEXT_PUBLIC_...` environment variables in Vercel.
4. Deploy, then add the Vercel URL to Supabase Auth's allowed redirect/site URLs.
5. Verify Google sign-in, player access, admin access, RLS, and production URL on real phones.

## Security notes
- RLS policies are the enforcement layer; UI role checks alone are not security.
- Players can read their own requests and create requests for their own profile only.
- Only admins can create matches and decide requests.
- New profiles default to the `player` role. Only a trusted project owner should promote admins.
- Configure appropriate authentication rate limits and access controls before inviting the whole team.
- Google OAuth identifies a user but does not automatically restrict access to team members. Use an approved-user process before inviting the team.
- The app intentionally does not collect identity documents or unnecessary personal data.

This package is a deployable project scaffold, not a live hosted website. You must connect your own Supabase and hosting accounts and configure Google OAuth and hosting before real players can sign in.
