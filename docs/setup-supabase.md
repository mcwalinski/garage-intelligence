# Supabase and Google Setup

This project is currently aligned to:

- hosting: Vercel Hobby
- database: Supabase Free
- auth: Supabase Auth with Google sign-in

## 1. Create the Supabase project

1. Create a new Supabase project on the Free plan.
2. Copy these values into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`

## 2. Configure Google sign-in in Supabase

1. In Supabase, open `Authentication > Providers > Google`.
2. Enable Google.
3. You will need a Google OAuth client from Google Cloud.

## 3. Create the Google OAuth client

1. In Google Cloud Console, create an OAuth client for a web application.
2. Add the Supabase callback URL shown in the Supabase Google provider screen.
3. Add your local and deployed app URLs as allowed origins if required by Google.
4. Paste the Google client ID and secret into the Supabase Google provider settings.

## 4. Configure app URLs

Set these values in your app environment:

- `NEXT_PUBLIC_APP_URL=http://localhost:3000` for local dev
- later, update to the Vercel production URL in production

## 5. What I still need from you

- the Supabase project URL
- the Supabase anon key
- the Supabase service role key
- confirmation that Google OAuth is enabled in the Supabase dashboard
- the production Vercel URL once deployed

## 6. Recommended next implementation step

After the Supabase project exists, the next code step is:

1. add the database schema
2. add auth-aware route protection
3. replace mocked vehicle data with seeded database records
