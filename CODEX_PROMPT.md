# Prompt for Codex

Copy everything below the line into Codex (run it from inside the `uvu-ambassadors` folder). Fill in the `<...>` values first. Any you don't have yet, write `later`.

---

You're picking up a working Next.js app called **UVU Ambassadors** that will live at **uvuambassadors.com**. It replaces SignUpGenius + manual tracking sheets for a university student-ambassador program (~40 ambassadors, 6 managers with teams of ~6, 4 admins). Each ambassador must do 7 tours, 6 events and 4 high school visits per semester (2 of the visits with an admissions counselor, "AC").

Read `AGENTS.md` and `README.md` before doing anything. The app already works end to end on a local demo database — do not rebuild or restyle it.

## What already exists
- Email-code sign-in (roster only), one-screen onboarding, personal calendar feed (.ics) for Outlook/Google/Apple
- Calendar (month / week / list) with left-side filters: All · Mine · Open, plus Tours / Events / High school visits / Outlook calendar checkboxes; one-tap sign up and drop; progress card (done vs. signed up, on track / behind)
- My shifts page
- Manager team view with status + "Send reminder" (personalized email listing exactly what each person still needs)
- Admin: overview (who's behind, what needs people), events (create, repeat weekly, edit, delete, CSV import), people + teams (CSV import), settings (semester dates, requirements, Outlook ICS link + sync, automatic emails)
- Daily job `/api/cron/daily`: Outlook sync, day-before shift reminders, Monday nudges
- Playwright smoke test of all three roles: `npm run test:smoke`

## Values
- Domain: uvuambassadors.com
- DATABASE_URL (Supabase "Transaction pooler" URI, port 6543 — or Neon pooled URL): `<paste>`
- RESEND_API_KEY: `<paste>`
- EMAIL_FROM: `UVU Ambassadors <hello@uvuambassadors.com>`
- First admin (me): `<Full Name>`, `<me@uvu.edu>`
- Outlook calendar ICS link: `<paste or later>`
- Roster CSV (name,email,role,team): `<path or later>`
- Semester: `<name, start date, end date>`

## Do this, in order. Stop and tell me if a step fails.
1. **Verify.** `npm install`, `npm run typecheck`, `npm run build`. Then stop any dev server and run `npx playwright install chromium` and `npm run test:smoke`. Everything must be green before you continue.
2. **Connect real services.** Copy `.env.example` to `.env.local` and fill in the values above. Generate `AUTH_SECRET` and `CRON_SECRET` with `openssl rand -base64 32`. Set `APP_URL=http://localhost:3000` locally. Run `npm run db:migrate`, then `npm run db:admin -- "<Full Name>" <me@uvu.edu>`. Start `npm run dev` and tell me to sign in with my email code — confirm the code email actually arrives.
3. **Put it on GitHub.** `git init`, commit, and create a **private** GitHub repo with `gh` (ask me for the repo name). Never commit `.env.local`.
4. **Deploy to Vercel.** If the `vercel` CLI is logged in, link and deploy with it; otherwise give me the exact clicks. Production env vars: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL=https://uvuambassadors.com`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`. Add the domain `uvuambassadors.com` and list the DNS records I need to set at my registrar. Also list the DNS records Resend needs to verify the domain.
5. **Check production.** `https://uvuambassadors.com/login` loads; `/api/cron/daily` returns 401 without the secret; I can sign in.
6. **Load real data** (only the values I gave you): set the semester in Admin → Settings, paste the Outlook link and press Sync now (tell me the count), import the roster CSV.
7. **Report back**: what's live, what I still need to click, anything that failed.

## Rules
- Keep the UI exactly this simple: UVU green + white + grey, rounded, plain words, no extra text or explanations. Reuse `src/components/ui.tsx` and the tokens in `src/app/globals.css`. Must work on a phone.
- All writes go through server actions that check the role (`requireUser` / `requireRole`).
- All times are Utah time — use `src/lib/dates.ts`.
- Never load demo data into a real database. Ask before deleting anything or running anything against production except migrations.
- After every change: `npm run typecheck`, `npm run build`, `npm run test:smoke`. When you add a flow, add it to `tests/smoke.spec.ts`.

## Assumptions I made — flag anything that looks wrong
- Only people with the **ambassador** role have requirements; managers and admins can sign up but aren't tracked.
- A sign-up counts as **done** automatically once the event ends; admins can mark a no-show from the event panel.
- **On track** = done + signed up keeps pace with how far into the semester we are.
- Anyone can drop a shift until it starts.

## Later — only when I say go (in this order)
1. Sign-up rules: no dropping within 24 hours of the start (show "ask your manager"), block double-booking overlapping shifts, waitlist when full with auto-fill + email.
2. SignUpGenius migration: import a SignUpGenius sign-ups report CSV (slots + who signed up) so this semester's past sign-ups count.
3. Attendance: after an event, admins confirm attendance in one tap ("everyone came" / mark no-shows).
4. Person page for managers/admins: one ambassador's shifts, history and progress.
5. Text reminders (Twilio) for the day-before reminder and nudges, opt-in per person.
6. Per-person requirement overrides (exempt, part-time) and optional requirements for managers.
7. Announcements: one pinned message at the top of the calendar, also emailed — to replace the info chat.
8. If UVU's Microsoft 365 blocks publishing the Outlook calendar as ICS, read it through Microsoft Graph instead.
