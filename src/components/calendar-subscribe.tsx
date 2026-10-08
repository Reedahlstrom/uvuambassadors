"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonClass } from "./ui";

export function CalendarSubscribe({ links }: { links: { https: string; apple: string; google: string; outlook: string } }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <a href={links.outlook} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md", "px-2")}>
          Outlook
        </a>
        <a href={links.google} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md", "px-2")}>
          Google
        </a>
        <a href={links.apple} className={buttonClass("secondary", "md", "px-2")}>
          Apple
        </a>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(links.https);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
        className="mt-2 flex w-full items-center justify-center gap-1.5 py-1.5 text-sm text-muted hover:text-ink"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
