"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const tabs = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <div className="mb-6">
      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-line bg-white p-1 shadow-soft sm:inline-grid">
        {tabs.map((t) => {
          const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cx(
                "rounded-xl px-1 py-2 text-center text-[13px] font-medium whitespace-nowrap transition-colors min-[380px]:text-[14px] sm:px-4 sm:text-[15px]",
                active ? "bg-brand text-white" : "text-ink-2 hover:bg-canvas",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
