# Deployment

## Target

- Hosting: Vercel Hobby
- Database/Auth: Supabase

## 1. Import the repo into Vercel

1. Open Vercel.
2. Create a new project from `mcwalinski/garage-intelligence`.
3. Accept the default Next.js framework settings.

Vercel supports Git-based deployment directly from GitHub repositories:
- [Vercel for GitHub](https://vercel.com/docs/deployments/git/vercel-for-github)
- [Deploying a Git repository](https://vercel.com/docs/deployments/git)

## 2. Configure production environment variables

Add these in the Vercel project settings:

### Required

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

### Current live integrations

- `SMARTCAR_CLIENT_ID`
- `SMARTCAR_CLIENT_SECRET`
- `SMARTCAR_REDIRECT_URI`
- `MARKETCHECK_API_KEY`
- `MARKETCHECK_CLIENT_SECRET`
- `MARKETCHECK_MARKET_ZIP`
- `MARKETCHECK_MARKET_CITY`
- `MARKETCHECK_MARKET_STATE`
- `MARKETCHECK_DEALER_TYPE`

### Optional / not fully live yet

- `RESEND_API_KEY`
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

Environment variable docs:
- [Vercel environment variables](https://vercel.com/docs/environment-variables)

## 3. Set the production URL

Once Vercel generates the project URL, set:

- `NEXT_PUBLIC_APP_URL=https://your-project.vercel.app`
- `SMARTCAR_REDIRECT_URI=https://your-project.vercel.app/api/integrations/smartcar/callback`

## 4. Update Supabase auth settings

In Supabase Auth, add:

- Site URL: `https://your-project.vercel.app`
- Redirect URL: `https://your-project.vercel.app/auth/callback`

Keep local URLs too.

## 5. Update Google OAuth

In Google Cloud OAuth client settings, add:

- Authorized JavaScript origin: `https://your-project.vercel.app`

Supabase remains the Google redirect URI handler. Do not replace the Supabase callback URI with the app callback.

## 6. Update Smartcar

In Smartcar app settings, add:

- `https://your-project.vercel.app/api/integrations/smartcar/callback`

## 7. Redeploy after provider updates

After the environment variables and callback URLs are correct, trigger a redeploy in Vercel.

## 8. Optional custom domain

After the base deploy works, attach a domain in Vercel:
- [Add a domain](https://vercel.com/docs/projects/domains/working-with-domains/add-a-domain)
