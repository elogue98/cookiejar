This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

Copy `.env.local` from the example below (or run `cp .env.local.example .env.local` once you create one) and fill it with your real credentials before running the app locally or on Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NEXT_PUBLIC_APP_URL=https://your-production-domain.example
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_MODEL_FALLBACK=gpt-4o
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY=your-google-maps-embed-key
```

The Supabase keys power storage/auth, OpenAI is used for recipe imports/tagging, `GOOGLE_MAPS_API_KEY` is required for the Tip Jar Google Maps importer (enable the Places API), and `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` is required for the Tip Jar map view (enable Maps Embed API).

The service-role key is server-only and must never be exposed to the browser. Complete the database/auth rollout from [docs/SECURITY_ROLLOUT.md](docs/SECURITY_ROLLOUT.md) before removing deployment protection.

## Private password entrance

`/admin/login` is an unlinked, password-only entrance for one existing linked family account. It uses normal Supabase authentication and grants that account's existing access. Set these **server-only** values locally and on the deployment:

```dotenv
ADMIN_LOGIN_EMAIL=the-existing-account-email
ADMIN_LOGIN_PROFILE_ID=the-existing-family-profile-uuid
```

Use Eoin's existing Auth email and the `users.id` linked to it through `user_auth_links`. Do not create another account or store a password in environment variables. The existing rate-limit migration and service-role configuration must be available; otherwise the entrance fails closed. The entrance permits ten attempts per ten minutes and fifty per day across all callers, so repeated guesses can temporarily block it; email login remains available.

To choose the password, sign in as Eoin using an email link once, then visit `/admin/password`. Enter and confirm a password of at least twelve characters (Supabase's configured password policy also applies). Only the configured profile can save a password there. Afterwards, bookmark `/admin/login` and enter just the password. Forgotten passwords can be replaced through the same email-login/setup flow. If Supabase requests recent authentication, obtain a fresh email sign-in before trying setup again.

Neither private URL is linked from normal site navigation; the regular email sign-in remains available. No password is included in source control or logs.

## CookieBot

CookieBot chat and recipe proposals use `gpt-6-luna` through the OpenAI Responses API with reasoning disabled for responsiveness. The optional server-only `COOKIEBOT_MODEL` setting overrides this dedicated model; the existing `OPENAI_MODEL` and `OPENAI_MODEL_FALLBACK` settings continue to control imports and tagging. CookieBot does not silently fall back to another model.

Answers stream as they arrive. Stop cancels generation, interrupted text remains visible, and retry replaces the interrupted turn. Drafts and conversation survive minimising the panel. Recipe edits are generated as previews; only **Apply changes** sends the existing authenticated recipe update request and records recipe history. Preview generation and Cancel do not save the recipe. Serving adjustments include the serving count. Responses are not stored by OpenAI (`store: false`); local chat state lasts for the current recipe page.

Streamdown renders incomplete Markdown with a subtle 160ms word fade while streaming. Completed messages shed animation wrappers; reduced-motion preferences disable the fades. Model-supplied HTML, images and links are excluded from recipe prose.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
