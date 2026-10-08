# UVU Ambassadors

One place for ambassador sign-ups. Replaces SignUpGenius + the tracking sheets.

- **Ambassadors** see every tour, event, high school visit and Outlook item on one calendar, filter what they see, sign up in one tap, and always know where they stand (7 tours · 6 events · 4 HS visits, 2 with an AC).
- **Managers** see their team at a glance and email reminders in two clicks.
- **Admins** see who's behind, what still needs people, and manage events, people, teams and the semester.

Stack: Next.js 16 · Tailwind 4 · Drizzle ORM · Postgres · Resend (email) · Vercel (hosting + daily job).

---

## Run it on your computer (2 minutes)

Needs Node 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and use the **Demo — sign in as** buttons (Ambassador / Manager / Admin).
No database or keys needed: it runs on a built-in demo database (`.data/`) with 50 fake people and a full semester.

- Fresh demo data: stop the server, `npm run db:reset`, `npm run dev`
- Smoke test of every role: stop the server, then `npx playwright install chromium` (first time) and `npm run test:smoke`

---

## Go live checklist

Fill these in tonight. Each step is independent.

### 1. Database (Supabase or Neon, free tier is plenty)
1. Create a project → **Connect** → copy the **Transaction pooler** connection string (port 6543), with your database password filled in.
2. Put it in `.env.local` as `DATABASE_URL=...` (copy `.env.example` to `.env.local` first).
3. Create the tables and yourself as the first admin:
   ```bash
   npm run db:migrate
   npm run db:admin -- "Your Name" you@uvu.edu
   ```
   With `DATABASE_URL` set, demo login turns off and sign-in is by email code.

### 2. Email (Resend)
1. resend.com → **Domains** → add `uvuambassadors.com` → add the DNS records it shows to your domain.
2. **API keys** → create one → `RESEND_API_KEY=...`
3. `EMAIL_FROM="UVU Ambassadors <hello@uvuambassadors.com>"`

Until this is set, emails (sign-in codes, reminders) print in the terminal instead of sending.

### 3. Deploy (Vercel) + domain
1. Push this folder to a GitHub repo → vercel.com → **Add New Project** → import it.
2. Environment variables: `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -base64 32`), `APP_URL=https://uvuambassadors.com`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` (any long random string).
3. **Settings → Domains** → add `uvuambassadors.com` → set the DNS records Vercel shows at your registrar.
4. Each deploy runs database migrations automatically (`vercel-build`). The daily job (`vercel.json`) runs at 8am Utah time: syncs Outlook, sends day-before shift reminders, and Monday nudges if turned on.

### 4. Inside the app (Admin)
1. **Settings** → semester dates, requirements (defaults 7 / 6 / 4 / 2), Outlook link.
   Outlook link: Outlook on the web → Settings → Calendar → Shared calendars → **Publish a calendar** → choose the program calendar → copy the **ICS** link.
2. **People** → **Import** the roster CSV (`name,email,role,team`). Teams are created automatically. Open a team to set its manager.
3. **Events** → **New** (use *Repeat every week until* for recurring tours) or **Import** a CSV (`title,type,date,start,end,location,spots,with_ac,notes`). A SignUpGenius export can be reshaped into this in a sheet.
4. Tell ambassadors: go to uvuambassadors.com, type your UVU email, enter the code. That's the whole onboarding.

---

## How it works

| Thing | Where |
| --- | --- |
| Pages | `src/app/(app)/calendar`, `my`, `team`, `admin/*`; sign-in at `src/app/login`, onboarding at `src/app/welcome` |
| Server actions (all writes) | `src/app/actions/*` — every one checks the user's role |
| Database schema | `src/lib/db/schema.ts` → `npm run db:generate` creates a migration in `/drizzle` |
| Requirement math (done / signed up / on track) | `src/lib/progress.ts` |
| Outlook import | `src/lib/outlook.ts` |
| Personal calendar feed (shifts → phone calendar) | `src/app/api/calendar/[token]/route.ts` |
| Daily job | `src/app/api/cron/daily/route.ts` |
| Colors / fonts | `src/app/globals.css` (`@theme`) |
| Demo data | `src/lib/db/seed-demo.ts` (only ever loaded into the local demo database) |

**Rules the app follows**
- A sign-up counts as *done* once the event ends (admins can mark a no-show from the event panel).
- *On track* = done + signed up keeps pace with how far into the semester it is. *Behind* = falling behind pace on any requirement.
- HS visits flagged *With AC* count toward both "HS visits" and "With AC".
- Outlook items are info-only. An admin can open one and give it spots to make it sign-up-able; the sync keeps that edit.
- All times are Utah time (`America/Denver`), no matter where the server runs.
