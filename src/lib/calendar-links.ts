export function feedLinks(base: string, token: string) {
  const https = `${base}/api/calendar/${token}.ics`;
  const webcal = https.replace(/^https?:\/\//, "webcal://");
  const name = "UVU Ambassador events";
  return {
    https,
    apple: webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent(name)}`,
  };
}

const gStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** One event, added right away (subscriptions can take hours to refresh, Google up to a day) */
export function addEventLinks(
  base: string,
  e: { id: string; title: string; startsAt: string; endsAt: string; allDay: boolean; location: string | null; notes: string | null },
) {
  const details = [e.notes, `${base}/my`].filter(Boolean).join("\n\n");
  const dates = e.allDay
    ? `${gStamp(e.startsAt).slice(0, 8)}/${gStamp(e.endsAt).slice(0, 8)}`
    : `${gStamp(e.startsAt)}/${gStamp(e.endsAt)}`;
  const g = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, details, location: e.location ?? "" });
  const o = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: e.startsAt,
    enddt: e.endsAt,
    body: details,
    location: e.location ?? "",
    ...(e.allDay ? { allday: "true" } : {}),
  });
  return {
    google: `https://calendar.google.com/calendar/render?${g}`,
    outlook: `https://outlook.office.com/calendar/0/deeplink/compose?${o}`,
    apple: `${base}/api/events/${e.id}/ics`,
  };
}
