<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# UVU Ambassadors — notes for coding agents

Sign-up + calendar app for ~40 ambassadors, 6 managers, 4 admins. Replaces SignUpGenius and manual tracking sheets. See README.md for the product and the go-live checklist.

## Commands
- `npm run dev` — runs `scripts/ensure-db.ts` first (migrations + demo data on the local PGlite database), then Next dev on :3000
- `npm run typecheck` — must pass
- `npm run build` — must pass
- `npm run test:smoke` — Playwright walk-through of every role on a throwaway database (`.data-test`). Stop `npm run dev` first (Next allows one dev server per project). First time: `npx playwright install chromium`
- `npm run db:generate` after editing `src/lib/db/schema.ts`, then `npm run db:migrate`
- `npm run db:reset` — wipes only the local demo database
- `npm run cf:deploy` — build with OpenNext and deploy to Cloudflare Workers (`wrangler.jsonc`, `worker.ts` = app + daily cron). Postgres goes through Hyperdrive (binding `HYPERDRIVE`); on Workers `getDb()` opens one connection per request.
- Real data: `PGLITE_DIR=.data-real npm run dev` locally; `scripts/import-signupgenius.ts` loads `data-private/` (gitignored — real names, never commit)

## Architecture
- Next.js 16 App Router, Server Components, Server Actions. **Not** using `cacheComponents`; pages are dynamic (they read the session cookie). After a mutation call `revalidatePath("/", "layout")`.
- Next 16 differences that matter here: `params` / `searchParams` / `cookies()` / `headers()` are async; read `node_modules/next/dist/docs/` before using an API you're unsure of.
- Database: Drizzle ORM. `DATABASE_URL` set → postgres-js; unset → PGlite in `.data/` (local demo). Always `const db = await getDb()`. Never load demo data into a real database (`scripts/seed.ts` refuses).
- Auth: email + 6-digit code (and a link) → signed JWT cookie (`src/lib/auth.ts`). Only people on the roster can sign in. Demo "sign in as" buttons exist only on the local demo DB (never when `DATABASE_URL` is set).
- Roles: `ambassador` (calendar, sign up, My shifts), `manager` (+ /team for teams where `teams.manager_id` = them, reminders to their team only), `admin` (+ /admin). Guard every server action with `requireUser()` / `requireRole()`.
- Requirements live on the `semesters` row (`req_tours`, `req_events`, `req_hs_visits`, `req_hs_visits_ac`). Progress math is pure and shared client/server: `src/lib/progress.ts`.
- Event types: `tour`, `event`, `hs_visit` (count toward requirements) and `calendar` (info only, e.g. Outlook). `spots = null` means no sign-up.
- Time: everything is shown and entered in Utah time via `src/lib/dates.ts` (`utahToDate`, `dayKey`, `timeShort`...). Never use the server's local time.
- Email: `src/lib/email.ts` (Resend; logs to the terminal when `RESEND_API_KEY` is unset). Bulk sends use `sendEmails` (batch API).

## UI rules (the owner cares a lot about these)
- Simple, UVU green + white + grey, rounded, human. Tokens are in `src/app/globals.css` `@theme`; reuse `src/components/ui.tsx` (Button, Card, StatusPill, Bar, Field, inputClass).
- Serif (`font-display`, Instrument Serif) only for page titles; Inter everywhere else.
- No extra text. Short labels, plain words, no explanations users don't need. Don't add helper paragraphs, marketing copy, or emojis.
- Everything must work on a phone (bottom tab bar, sheets instead of side panels).
- No browser `alert`/`confirm`; use the two-click confirm pattern already in the code.
