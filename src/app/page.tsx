import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, Play } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: { absolute: "UVU Ambassadors" },
  description: "Tours, events and high school visits in one place. A product of Alta Labs LLC.",
};

const COMPARE: [string, string][] = [
  [
    "Five SignUpGenius sheets, the Outlook calendar and a tracking spreadsheet",
    "One site with every tour, event and high school visit",
  ],
  ["Students count their own shifts to see if they're on pace", "Each student sees what's done and exactly what they still need"],
  ["Managers dig through sheets to find who's behind", "Managers see their whole team's progress and send reminders in two clicks"],
  ["Admins match names across sheets by hand", "Admins see who's behind and which shifts need people on one screen"],
  [
    "Names are typed in, so “Will Bates” and “William Bates III” count as two people",
    "Everyone signs in, so every shift counts for the right person",
  ],
  ["Reminders go out by hand, if they go out", "Automatic email the day before every shift"],
  ["Shifts get copied into personal calendars", "Shifts sync to Outlook, Google or Apple Calendar"],
];

const ROLES = [
  {
    who: "Students",
    title: "Sign up in one tap",
    points: [
      "Only shows shifts that still have open spots",
      "Shows how many spots are left and what still counts toward requirements",
      "Progress for tours, events and high school visits always on screen",
      "Add any event to Outlook, Google or Apple Calendar",
      "Works on any phone, nothing to install",
    ],
    img: { src: "/landing/student.webp", w: 2880, h: 1800, alt: "Sign up page for an ambassador" },
    phone: { src: "/landing/student-phone.webp", w: 780, h: 1688, alt: "Sign up page on a phone" },
  },
  {
    who: "Managers",
    title: "Know who's behind",
    points: [
      "Everyone on your team with their progress, status and next shift",
      "Filter to Behind or No sign-ups",
      "Remind one person or the whole group with an email you can edit",
      "Mark no-shows for your team",
    ],
    img: { src: "/landing/manager.webp", w: 2880, h: 1800, alt: "Team page for a manager" },
  },
  {
    who: "Admins",
    title: "The whole program on one screen",
    points: [
      "Who's behind, on track or done, across every team",
      "Shifts in the next two weeks that still need people",
      "Drag an event to a new day and everyone signed up gets an email",
      "Import the roster, move people between teams, export everyone's progress to CSV",
    ],
    img: { src: "/landing/admin.webp", w: 2880, h: 1800, alt: "Admin overview" },
  },
];

export default async function Home() {
  if (await getCurrentUser()) redirect("/signup");

  return (
    <div className="min-h-dvh bg-white text-ink">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg font-bold text-white">U</span>
          <span className="font-display text-[22px] leading-none">UVU Ambassadors</span>
        </Link>
        <Link href="/login" className={buttonClass("outline", "sm")}>
          Sign in
        </Link>
      </header>

      <section className="overflow-hidden bg-[radial-gradient(70%_50%_at_50%_75%,rgb(58_138_82/0.28)_0%,rgb(246_247_246/0)_100%)]">
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-16 text-center sm:px-6 sm:pt-20 sm:pb-24">
          <p className="mb-5 inline-block rounded-full bg-brand-soft px-3.5 py-1 text-[13px] font-medium text-brand">
            A product of Alta Labs LLC
          </p>
          <h1 className="font-display mx-auto max-w-4xl text-[46px] leading-[0.98] text-balance text-ink sm:text-[76px]">
            Ambassador scheduling in one place
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-2 sm:text-[19px]">
            Tours, events and high school visits. Students sign up, managers keep their teams on track, and admins see the
            whole program. No more SignUpGenius links and tracking sheets.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="#demo"
              className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-line bg-white px-7 text-base font-medium text-brand shadow-soft transition-colors hover:bg-brand-soft"
            >
              <Play size={18} /> Watch it work
            </a>
            <Link href="/login" className={buttonClass("primary", "lg")}>
              Sign in <ArrowRight size={18} />
            </Link>
          </div>

          <div id="demo" className="mx-auto mt-14 max-w-5xl scroll-mt-6 overflow-hidden rounded-2xl border border-line bg-white shadow-pop">
            <div className="flex h-9 items-center gap-1.5 border-b border-line bg-canvas px-4">
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="h-2.5 w-2.5 rounded-full bg-line" />
              <span className="ml-3 text-[12px] text-muted">uvuambassadors.com</span>
            </div>
            <div className="overflow-hidden">
              <video
                className="ml-[-0.7%] block aspect-[8/5] w-[100.7%] max-w-none"
                src="/landing/demo.webm"
                poster="/landing/demo-poster.webp"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="An ambassador signs up for a campus tour, then checks My events and the calendar"
              />
            </div>
          </div>
          <p className="mt-4 text-[14px] text-muted">
            An ambassador signs up for a tour in two clicks. It shows up in My events and on the calendar right away.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="font-display text-[38px] leading-none sm:text-[52px]">What changes</h2>
        <p className="mt-3 max-w-2xl text-[17px] text-muted">
          Less time setting up sheets and checking who did what. More of the program&apos;s time goes to tours and visits.
        </p>
        <div className="mt-10 overflow-hidden rounded-2xl border border-line">
          <div className="hidden grid-cols-2 bg-canvas text-[13px] font-semibold tracking-wide text-muted uppercase sm:grid">
            <div className="px-6 py-3">Now</div>
            <div className="border-l border-line px-6 py-3 text-brand">With UVU Ambassadors</div>
          </div>
          {COMPARE.map(([before, after]) => (
            <div key={after} className="grid border-t border-line first:border-t-0 sm:grid-cols-2 sm:first:border-t">
              <div className="px-5 pt-4 text-[15px] text-muted sm:px-6 sm:py-5">
                <span className="mb-1 block text-[12px] font-semibold tracking-wide uppercase sm:hidden">Now</span>
                {before}
              </div>
              <div className="flex gap-3 px-5 pt-3 pb-4 text-[15px] font-medium text-ink sm:border-l sm:border-line sm:px-6 sm:py-5">
                <Check size={18} className="mt-0.5 shrink-0 text-brand" />
                {after}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-canvas">
        <div className="mx-auto max-w-6xl space-y-20 px-4 py-16 sm:space-y-28 sm:px-6 sm:py-24">
          {ROLES.map((r, i) => (
            <div key={r.who} className="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
              <div className={i % 2 ? "lg:order-2" : undefined}>
                <p className="text-[13px] font-semibold tracking-wide text-brand uppercase">{r.who}</p>
                <h3 className="font-display mt-2 text-[34px] leading-none sm:text-[44px]">{r.title}</h3>
                <ul className="mt-6 space-y-3">
                  {r.points.map((p) => (
                    <li key={p} className="flex gap-3 text-[16px] text-ink-2">
                      <Check size={18} className="mt-1 shrink-0 text-brand" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={i % 2 ? "relative lg:order-1" : "relative"}>
                <img
                  src={r.img.src}
                  width={r.img.w}
                  height={r.img.h}
                  alt={r.img.alt}
                  loading="lazy"
                  className="h-auto w-full rounded-2xl border border-line bg-white shadow-pop"
                />
                {r.phone && (
                  <img
                    src={r.phone.src}
                    width={r.phone.w}
                    height={r.phone.h}
                    alt={r.phone.alt}
                    loading="lazy"
                    className="absolute -right-2 -bottom-10 hidden h-auto w-[28%] rounded-[22px] border-4 border-ink bg-white shadow-pop sm:block lg:-right-6"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer>
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-[14px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>UVU Ambassadors is a product of Alta Labs LLC.</p>
          <p>© 2026 Alta Labs LLC</p>
        </div>
      </footer>
    </div>
  );
}
