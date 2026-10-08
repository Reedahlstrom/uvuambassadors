// Central place for things you may want to change.

export const APP_NAME = "UVU Ambassadors";

// All times are shown in Utah time, no matter where the server runs.
export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "America/Denver";

export const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const EMAIL_FROM = process.env.EMAIL_FROM || "UVU Ambassadors <hello@uvuambassadors.com>";

// Demo login ("sign in as ...") only exists on the local demo database — never when DATABASE_URL is set.
export const DEMO_MODE =
  !process.env.DATABASE_URL && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true");

export const TYPE_META = {
  tour: { label: "Tours", single: "Tour", color: "var(--c-tour)" },
  event: { label: "Events", single: "Event", color: "var(--c-event)" },
  hs_visit: { label: "High school visits", single: "High school visit", color: "var(--c-hs)" },
  calendar: { label: "Outlook calendar", single: "Calendar", color: "var(--c-cal)" },
} as const;

// Demo accounts created by the demo data (all @example.com, never real people)
export const DEMO_EMAILS = {
  ambassador: "reed.ahlstrom@example.com",
  manager: "javi@example.com",
  admin: "admin@example.com",
};

// New accounts (people not already on the roster) must use one of these email domains
export const SIGNUP_DOMAINS = ["uvu.edu", "my.uvu.edu"];

// People imported from SignUpGenius before their real email is known (.invalid can never receive mail)
export const PLACEHOLDER_EMAIL_DOMAIN = "@needs-email.invalid";
