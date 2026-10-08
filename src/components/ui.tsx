import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Status } from "@/lib/progress";
import { STATUS_LABEL } from "@/lib/progress";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors select-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover shadow-[0_1px_2px_rgb(39_93_56/0.25)]",
  secondary: "bg-brand-soft text-brand hover:bg-brand-soft-hover",
  ghost: "text-ink-2 hover:bg-brand-soft/70",
  outline: "border border-line bg-white text-ink hover:bg-canvas",
  danger: "bg-bad-soft text-bad hover:bg-[#fbd9d9]",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(base, variants[variant], sizes[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-line bg-white shadow-soft", className)} {...props} />;
}

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-display text-[34px] leading-none text-ink sm:text-[40px]">{children}</h1>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Bar({ value, max, color = "var(--color-brand)", soft }: { value: number; max: number; color?: string; soft?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const softPct = max > 0 ? Math.min(100 - pct, ((soft ?? 0) / max) * 100) : 0;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#eceeec]">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      {softPct > 0 && (
        <div
          className="h-full rounded-r-full"
          style={{ width: `${softPct}%`, background: color, opacity: 0.28, marginLeft: pct > 0 ? -2 : 0 }}
        />
      )}
    </div>
  );
}

const statusStyle: Record<Status, string> = {
  complete: "bg-brand-soft text-brand",
  on_track: "bg-good-soft text-good",
  behind: "bg-warn-soft text-warn",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={cx("inline-flex h-7 items-center rounded-full px-3 text-[13px] font-medium", statusStyle[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-10 text-center text-muted">{children}</div>;
}

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-faint focus:border-brand-bright focus:outline-none focus:ring-4 focus:ring-brand-bright/10";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
