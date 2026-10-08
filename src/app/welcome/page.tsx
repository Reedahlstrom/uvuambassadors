import type { Metadata } from "next";
import { finishOnboarding } from "@/app/actions/profile";
import { CalendarSubscribe } from "@/components/calendar-subscribe";
import { Button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { feedLinks } from "@/lib/calendar-links";
import { getSemester, reqsOf } from "@/lib/data";
import { baseUrl } from "@/lib/url";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const user = await requireUser();
  const semester = await getSemester();
  const reqs = reqsOf(semester);
  const links = feedLinks(await baseUrl(), user.calendarToken);
  const first = user.name.split(" ")[0];

  const tiles = [
    { n: reqs.tour, label: "Tours", color: "var(--color-tour)" },
    { n: reqs.event, label: "Events", color: "var(--color-event)" },
    { n: reqs.hs_visit, label: "High school visits", sub: `${reqs.hs_visit_ac} with an AC`, color: "var(--color-hs)" },
  ];

  return (
    <main className="hero-glow flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[520px] rounded-3xl bg-white p-6 shadow-pop sm:p-9">
        <h1 className="font-display text-[44px] leading-none text-ink">Welcome, {first}</h1>

        {user.role === "ambassador" && (
          <section className="mt-8">
            <p className="mb-3 font-semibold text-ink">Each semester you do</p>
            <div className="grid grid-cols-3 gap-2.5">
              {tiles.map((t) => (
                <div key={t.label} className="rounded-2xl bg-canvas px-3 py-4 text-center">
                  <p className="text-[34px] leading-none font-semibold tabular-nums" style={{ color: t.color }}>
                    {t.n}
                  </p>
                  <p className="mt-2 text-[13px] leading-tight font-medium text-ink-2">{t.label}</p>
                  {t.sub && <p className="mt-0.5 text-xs text-muted">{t.sub}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <p className="font-semibold text-ink">Put your shifts in your calendar</p>
          <p className="mb-3 text-sm text-muted">Anything you sign up for shows up automatically.</p>
          <CalendarSubscribe links={links} />
        </section>

        <form action={finishOnboarding} className="mt-8">
          <Button type="submit" size="lg" className="h-13 w-full text-[16px]">
            Start signing up
          </Button>
        </form>
      </div>
    </main>
  );
}
