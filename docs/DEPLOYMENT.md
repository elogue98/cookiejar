# Deploying to Vercel

Use this checklist to get a production URL you can share with your family.

## 1. Prerequisites
- Node.js 18+ (`node -v`) and npm 10+
- A Vercel account with the CLI installed (`npm i -g vercel`) or access to the dashboard
- Supabase (and OpenAI) credentials handy

## 2. Configure local env
1. Copy the template and fill in *real* values:
   ```bash
   cp .env.local .env.production # optional if you want a prod-specific file
   ```
2. Required keys (same list goes into Vercel):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (default: `gpt-4o-mini`)
   - `OPENAI_MODEL_FALLBACK` (default: `gpt-4o`)

> Tip: With Supabase you can grab these under **Project Settings → API**. For OpenAI hit **View API keys** in the dashboard.

## 3. Verify the app locally
```bash
npm install
npm run lint   # expect known legacy lint warnings, but no new ones
npm run build  # should finish without TypeScript errors
```

If Supabase requests fail locally during `npm run build`, double‑check your URL, anon key, and that the table policies allow the requests.

## 4. Create + link the Vercel project
```bash
vercel login                # once per machine
vercel link                 # follow prompts to create/link the project
```
When prompted for the framework, choose **Next.js**. Accept the detected build command (`next build`) and `npm install` as the install command.

## 5. Add environment variables in Vercel
Either use the dashboard (**Settings → Environment Variables**) or the CLI:
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production 
vercel env add SUPABASE_SERVICE_ROLE_KEY production 
vercel env add OPENAI_API_KEY production 
vercel env add OPENAI_MODEL production gpt-4o-mini
vercel env add OPENAI_MODEL_FALLBACK production gpt-4o
```
Repeat for **Preview** and **Development** environments if you plan to use them.

If Supabase enforces redirect/callback allow-lists, add the new `https://<project>.vercel.app` domain under **Authentication → URL Configuration** so logins keep working.

## 6. Deploy
```bash
vercel --prod
```
Vercel runs `npm install`, `npm run lint`, and `npm run build`. Once completed, it prints the production URL (also visible under the project’s Deployments tab).

## 7. Smoke test production
- Log in, switch profiles, and open a recipe
- Import a recipe (image + URL) so OpenAI + Supabase storage paths are exercised
- Create/edit/delete a recipe, then refresh another browser to confirm it propagates
- Share the `https://<project>.vercel.app` link with your family 🎉

Keep this doc next to the repo so future deploys are one command away.

