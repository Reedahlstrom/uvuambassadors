import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  if (await getCurrentUser()) redirect("/signup");
  const { expired } = await searchParams;
  return (
    <main className="hero-glow flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <h1 className="font-display mb-8 text-center text-[52px] leading-[0.95] text-white drop-shadow-[0_2px_12px_rgb(28_33_30/0.25)] sm:text-[64px]">
          UVU Ambassadors
        </h1>
        <div className="rounded-3xl border border-white/60 bg-white/95 p-6 shadow-pop backdrop-blur sm:p-8">
          <LoginForm demo={DEMO_MODE} expired={!!expired} />
        </div>
      </div>
    </main>
  );
}
