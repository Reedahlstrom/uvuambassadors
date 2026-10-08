import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { microsoftEnabled } from "@/lib/microsoft";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const MS_ERRORS: Record<string, string> = {
  failed: "Microsoft sign-in didn't work. Try again, or use an email code.",
  cancelled: "Microsoft sign-in was cancelled.",
  off: "Microsoft sign-in isn't set up yet. Use an email code.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string; ms?: string; email?: string }> }) {
  if (await getCurrentUser()) redirect("/signup");
  const { expired, ms, email } = await searchParams;
  const msError =
    ms === "notlisted"
      ? `${email ?? "That account"} isn't on the ambassador list. Ask your manager to add you.`
      : ms
        ? (MS_ERRORS[ms] ?? MS_ERRORS.failed)
        : undefined;
  return (
    <main className="hero-glow flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <h1 className="font-display mb-8 text-center text-[52px] leading-[0.95] text-white drop-shadow-[0_2px_12px_rgb(28_33_30/0.25)] sm:text-[64px]">
          UVU Ambassadors
        </h1>
        <div className="rounded-3xl border border-white/60 bg-white/95 p-6 shadow-pop backdrop-blur sm:p-8">
          <LoginForm demo={DEMO_MODE} expired={!!expired} microsoft={microsoftEnabled()} msError={msError} />
        </div>
      </div>
    </main>
  );
}
