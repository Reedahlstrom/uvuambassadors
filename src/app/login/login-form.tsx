"use client";

import { useActionState, useTransition } from "react";
import { demoLogin, requestLogin, verifyCode, type LoginState } from "@/app/actions/auth";
import { Button, inputClass } from "@/components/ui";

const DEMO_LABEL = { ambassador: ["Reed", "Ambassador"], manager: ["Javi", "Manager"], admin: ["Program", "Admin"] } as const;

export function LoginForm({ demo, expired }: { demo: boolean; expired: boolean }) {
  const [emailState, sendCode, sending] = useActionState<LoginState, FormData>(requestLogin, { step: "email" });
  const [codeState, checkCode, checking] = useActionState<LoginState, FormData>(verifyCode, { step: "code" });
  const [demoPending, startDemo] = useTransition();

  const onCodeStep = emailState.step === "code";

  if (onCodeStep) {
    return (
      <form action={checkCode} className="space-y-4">
        <div>
          <p className="text-lg font-semibold text-ink">Check your email</p>
          <p className="mt-1 text-[15px] text-muted">
            We sent a 6-digit code to <span className="font-medium text-ink-2">{emailState.email}</span>
          </p>
        </div>
        <input type="hidden" name="email" value={emailState.email} />
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          autoFocus
          required
          placeholder="000000"
          aria-label="6-digit code"
          className={inputClass + " h-14 text-center text-2xl font-semibold tracking-[0.4em]"}
        />
        {emailState.devCode && (
          <p className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-brand">
            Email isn&apos;t connected yet. Your code is <b>{emailState.devCode}</b>
          </p>
        )}
        {codeState.error && <p className="text-sm text-bad">{codeState.error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={checking}>
          {checking ? "Signing in…" : "Sign in"}
        </Button>
        <button type="button" onClick={() => location.reload()} className="w-full text-sm text-muted hover:text-ink">
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <form action={sendCode} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-medium text-ink">Your UVU email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            defaultValue={emailState.email}
            placeholder="you@uvu.edu"
            className={inputClass + " h-12"}
          />
        </label>
        {expired && !emailState.error && <p className="text-sm text-warn">That link expired. Enter your email for a new code.</p>}
        {emailState.error && <p className="text-sm text-bad">{emailState.error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={sending}>
          {sending ? "Sending…" : "Email me a code"}
        </Button>
      </form>

      {demo && (
        <div className="border-t border-line pt-5">
          <p className="mb-3 text-center text-sm text-muted">Demo — sign in as</p>
          <div className="grid grid-cols-3 gap-2">
            {(["ambassador", "manager", "admin"] as const).map((r) => (
              <Button
                key={r}
                variant="secondary"
                size="sm"
                disabled={demoPending}
                onClick={() => startDemo(() => demoLogin(r))}
                className="h-auto flex-col gap-0 py-2"
              >
                <span>{DEMO_LABEL[r][0]}</span>
                <span className="text-xs font-normal opacity-75">{DEMO_LABEL[r][1]}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
