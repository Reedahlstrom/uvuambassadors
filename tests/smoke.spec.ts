import http from "node:http";
import { expect, test, type Page } from "@playwright/test";

// One long walk through every role on a fresh demo database.
// Run with: npm run test:smoke   (stop `npm run dev` first — Next allows one dev server per project)

async function demoLogin(page: Page, role: "Ambassador" | "Manager" | "Admin") {
  await page.goto("/login");
  await page.getByRole("button", { name: role }).click();
  await page.waitForURL("**/signup");
}

function outlookFixture() {
  // A small Outlook-style calendar relative to today: weekly huddle x6, a one-off, an all-day item
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); // next Monday
  const ymd = (x: Date) => x.toISOString().slice(0, 10).replace(/-/g, "");
  const plus = (n: number) => new Date(d.getTime() + n * 86400000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:huddle",
    "SUMMARY:Staff huddle",
    "DTSTART;TZID=America/Denver:" + ymd(d) + "T090000",
    "DTEND;TZID=America/Denver:" + ymd(d) + "T093000",
    "RRULE:FREQ=WEEKLY;COUNT=6",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:planning",
    "SUMMARY:Preview Day planning",
    "DTSTART:" + ymd(plus(1)) + "T220000Z",
    "DTEND:" + ymd(plus(1)) + "T230000Z",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:midterms",
    "SUMMARY:Midterms week",
    "DTSTART;VALUE=DATE:" + ymd(plus(7)),
    "DTEND;VALUE=DATE:" + ymd(plus(12)),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

test("ambassador, manager and admin flows", async ({ browser, request }) => {
  const errors: string[] = [];

  // ---------- Ambassador: email code sign-in ----------
  let ctx = await browser.newContext();
  let page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/login");
  await page.fill("input[name=email]", "nobody@uvu.edu");
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByText("isn't on the ambassador list")).toBeVisible();
  await page.fill("input[name=email]", "Reed.Ahlstrom@example.com");
  await page.getByRole("button", { name: "Email me a code" }).click();
  const hint = await page.getByText("Your code is").innerText();
  const code = hint.match(/(\d{6})/)![1];
  await page.fill("input[name=code]", code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That code didn't work")).toBeVisible();
  await page.fill("input[name=code]", code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/signup");

  // Sign up page: what I still need, open spots only, one tap to join (the row stays and says "You're in")
  await expect(page.getByText("Still need").first()).toBeVisible();
  const openBefore = await page.getByRole("button", { name: "Sign up", exact: true }).count();
  expect(openBefore).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Sign up", exact: true }).first().click();
  await expect(page.getByText("You're signed up. It's in My shifts.")).toBeVisible();
  await expect(page.getByText("You're in").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up", exact: true })).toHaveCount(openBefore - 1);
  // type filter
  await page.getByRole("button", { name: /^Tours/ }).click();
  await expect(page.locator("main").getByText("Event", { exact: true })).toHaveCount(0);

  // one-tap sign up from the calendar list
  await page.goto("/calendar");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("button", { name: "Sign up", exact: true }).first().click();
  await expect(page.getByText("You're signed up").first()).toBeVisible();

  // "Mine" shows only my things
  await page.getByRole("button", { name: "Mine", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign up" })).toHaveCount(0);
  await page.locator("button:has(span.block)").first().click();
  // dropping from the panel asks first
  await page.getByRole("dialog").getByRole("button", { name: "Drop" }).click();
  await expect(page.getByText("Drop this shift?")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Keep" }).click();
  await expect(page.getByRole("dialog").getByText("You're signed up")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "All", exact: true }).click();

  // drop from My shifts
  await page.goto("/my");
  const before = await page.getByRole("button", { name: "Drop" }).count();
  await page.getByRole("button", { name: "Drop" }).first().click();
  await page.getByRole("button", { name: "Drop" }).first().click();
  await expect(page.getByText("Dropped")).toBeVisible();
  await expect(page.getByRole("button", { name: "Drop" })).toHaveCount(before - 1);

  // personal calendar feed
  const token = (await page.content()).match(/\/api\/calendar\/([A-Za-z0-9_-]+)\.ics/)![1];
  const ics = await (await request.get(`/api/calendar/${token}.ics`)).text();
  expect(ics).toContain("BEGIN:VCALENDAR");

  // no admin access
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/signup$/);
  // ambassadors can't open person pages
  await page.goto("/people/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/signup$/);
  await ctx.close();

  // ---------- Manager: remind someone ----------
  ctx = await browser.newContext();
  page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await demoLogin(page, "Manager");
  await page.goto("/team");
  await page.getByRole("button", { name: /^Behind/ }).click();
  await page.getByRole("checkbox").nth(1).click();
  await page.getByRole("button", { name: "Send reminder" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByText("You still need")).toBeVisible();
  await dlg.getByRole("button", { name: /^Send to/ }).click();
  await expect(page.getByText(/Reminder sent to \d/)).toBeVisible();
  // manager can open someone on their team
  await page.locator("table a[href^='/people/']").first().click();
  await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "My team" })).toBeVisible();
  // ...but nobody outside their team
  await page.goto("/people/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText("404")).toBeVisible();
  await ctx.close();

  // ---------- Admin ----------
  ctx = await browser.newContext();
  page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await demoLogin(page, "Admin");
  await page.goto("/admin");
  await expect(page.getByText("Ambassadors", { exact: true })).toBeVisible();

  // person page from the overview
  await page.locator("table a[href^='/people/']").first().click();
  await expect(page.getByRole("heading", { name: "Done this semester" })).toBeVisible();

  // move someone to another team right from the People list
  await page.goto("/admin/people");
  const teamSelect = page.getByRole("combobox", { name: /^Team for / }).first();
  const firstTeam = await teamSelect.locator("option").nth(1).textContent();
  await teamSelect.selectOption({ index: 1 });
  await expect(page.getByText(`Moved to ${firstTeam}`)).toBeVisible();

  // repeat weekly
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const later = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);
  await page.goto("/admin/events/new");
  await page.getByRole("button", { name: "Event", exact: true }).click();
  await page.fill("input[name=title]", "QA Test Night");
  await page.fill("input[name=date]", nextWeek);
  await page.fill("input[name=start]", "18:00");
  await page.fill("input[name=end]", "19:30");
  await page.fill("input[name=repeatUntil]", later);
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL("**/admin/events");
  await expect(page.getByText("QA Test Night")).toHaveCount(4);
  await page.getByText("QA Test Night").first().click();
  await expect(page.locator("input[name=start]")).toHaveValue("18:00");
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "This and later" }).click();
  await page.waitForURL("**/admin/events");
  await expect(page.getByText("QA Test Night")).toHaveCount(0);

  // CSV imports
  await page.goto("/admin/events/import");
  await page.locator("textarea").fill(`title,type,date,start,end,location,spots,with_ac\nCSV Tour,tour,${nextWeek},10:00,11:00,Welcome Center,2,`);
  await page.getByRole("button", { name: /^Import/ }).last().click();
  await expect(page.getByText("Done — 1 added")).toBeVisible();
  await page.goto("/admin/people/import");
  await page.locator("textarea").fill("name,email,role,team\nNew Person,new.person@example.com,ambassador,Team Zion");
  await page.getByRole("button", { name: /^Import/ }).last().click();
  await expect(page.getByText("Done — 1 added")).toBeVisible();

  // Outlook sync from a local .ics server
  const server = http.createServer((_q, r) => r.end(outlookFixture())).listen(0);
  const port = (server.address() as { port: number }).port;
  await page.goto("/admin/settings");
  await page.fill("input[name=outlookUrl]", `http://localhost:${port}/cal.ics`);
  await page.getByRole("button", { name: "Save" }).last().click();
  await expect(page.getByText("Saved").last()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByText(/Synced 8 Outlook items/)).toBeVisible();
  server.close();

  // daily job
  const cron = await (await request.get("/api/cron/daily")).json();
  expect(cron.ok).toBe(true);

  expect(errors).toEqual([]);
  await ctx.close();
});
