"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, CircleCheck, CirclePlus, LayoutDashboard, LogOut, Users } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Avatar, cx } from "./ui";

type Role = "ambassador" | "manager" | "admin";

const items = [
  { href: "/signup", label: "Sign up", icon: CirclePlus, roles: ["ambassador", "manager", "admin"] },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["ambassador", "manager", "admin"] },
  { href: "/my", label: "My events", icon: CircleCheck, roles: ["ambassador", "manager", "admin"] },
  { href: "/team", label: "My team", icon: Users, roles: ["manager"] },
  { href: "/admin", label: "Admin", icon: LayoutDashboard, roles: ["admin"] },
] as const;

export function Nav({ user }: { user: { name: string; role: Role } }) {
  const path = usePathname();
  const visible = items.filter((i) => (i.roles as readonly string[]).includes(user.role));
  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
          <Link href="/signup" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-[22px] leading-none text-ink">UVU Ambassadors</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {visible.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={cx(
                  "rounded-xl px-3.5 py-2 text-[15px] font-medium transition-colors",
                  isActive(i.href) ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-canvas",
                )}
              >
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <UserMenu name={user.name} role={user.role} />
          </div>
        </div>
      </header>

      {/* Phone tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md">
          {visible.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={cx(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                isActive(i.href) ? "text-brand" : "text-muted",
              )}
            >
              <i.icon size={22} strokeWidth={isActive(i.href) ? 2.2 : 1.8} />
              {i.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

function UserMenu({ name, role }: { name: string; role: Role }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-1 hover:bg-canvas sm:pr-3"
        aria-label="Account"
      >
        <Avatar name={name} size={34} />
        <span className="hidden text-[15px] font-medium text-ink-2 sm:block">{name.split(" ")[0]}</span>
      </button>
      {open && (
        <div className="anim-fade absolute right-0 mt-2 w-56 rounded-2xl border border-line bg-white p-2 shadow-pop">
          <div className="px-3 py-2">
            <p className="font-medium text-ink">{name}</p>
            <p className="text-sm capitalize text-muted">{role}</p>
          </div>
          <form action={signOut}>
            <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[15px] text-ink-2 hover:bg-canvas">
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#275d38" />
      <path d="M20 18v17a12 12 0 0 0 24 0V18" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
