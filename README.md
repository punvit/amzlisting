# ListingLab

AI-powered Amazon listing generator. Next.js 14 (App Router) + Tailwind + Supabase.

This repo is being built in phases. **Section 1 (Auth + schema) is done.**

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project, then copy your keys into `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

   For Section 1 you only need:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

   (The rest are placeholders used by later sections.)

3. Run the database schema: open the Supabase **SQL Editor** and run the
   contents of [`supabase/schema.sql`](supabase/schema.sql). This creates all
   tables, RLS policies, and the trigger that auto-creates a free profile
   (3 credits) on signup.

4. (Optional for local dev) In **Supabase → Authentication → Providers → Email**,
   turn **"Confirm email"** OFF so signups log in instantly. If you leave it ON,
   confirm via the emailed link (handled at `/auth/callback`).

5. Start the dev server:

   ```bash
   npm run dev
   ```

## Test Section 1

- Visit `http://localhost:3000` → landing page.
- Go to **Sign up**, create an account.
  - Email confirm OFF → redirected straight to `/dashboard`.
  - Email confirm ON → "check your email" message; confirm, then log in.
- On the dashboard you should see your email, **plan = free**, and
  **credits = 3** (proves the signup trigger ran).
- Click **Sign out** → back to `/login`.
- Try visiting `/dashboard` while logged out → redirected to `/login`.

## Build roadmap

1. ✅ Supabase schema + auth pages
2. ✅ Dashboard with listing list
3. ✅ Upload flow + product detection (Anthropic Claude vision)
4. ✅ Generation pipeline (Remove.bg → FAL FLUX Kontext × 4 → Claude copy)
5. ✅ Results page (editable copy, downloads, ZIP export)
6. ✅ Credits + Razorpay (plans, upgrade modal, webhook)

## Stack notes (adapted during build)

- AI copy + vision: Anthropic Claude (`claude-haiku-4-5`)
- Lifestyle images: FAL `fal-ai/flux-kontext/dev` (Male/Female prompt sets, 4 per listing)
- Image storage: Supabase Storage (public `listings` bucket)
- Payments: Razorpay subscriptions
