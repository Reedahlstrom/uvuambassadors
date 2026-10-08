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
    <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex gap-1 rounded-2xl border border-line bg-white p-1 shadow-soft">
        {tabs.map((t) => {
          const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cx(
                "rounded-xl px-4 py-2 text-[15px] font-medium whitespace-nowrap transition-colors",
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
