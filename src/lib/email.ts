import "server-only";
import { Resend } from "resend";
import { APP_URL, EMAIL_FROM } from "./config";
import { getDb, schema } from "./db";

export type Mail = {
  to: string;
  subject: string;
  heading: string;
  lines: string[];
  button?: { label: string; url: string };
  kind: "login" | "reminder" | "shift" | "nudge";
  toUserId?: string;
  sentById?: string;
};

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const emailEnabled = !!resend;

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render(m: Mail) {
  const body = m.lines.map((l) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#222723">${escape(l)}</p>`).join("");
  const button = m.button
    ? `<p style="margin:24px 0 8px"><a href="${m.button.url}" style="background:#275d38;color:#fff;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:600;font-size:15px;display:inline-block">${escape(m.button.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f6f5;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<div style="background:#fff;border-radius:20px;padding:32px;border:1px solid #e4e7e5">
<p style="margin:0 0 20px;font-size:13px;letter-spacing:.04em;color:#5f6662">UVU AMBASSADORS</p>
<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:400;font-size:28px;color:#1c211e">${escape(m.heading)}</h1>
${body}${button}
</div>
<p style="text-align:center;font-size:12px;color:#8e9490;margin-top:16px">${APP_URL.replace(/^https?:\/\//, "")}</p>
</div></body></html>`;
}

function toText(m: Mail) {
  return [m.heading, "", ...m.lines, m.button ? `\n${m.button.label}: ${m.button.url}` : ""].join("\n");
}

/** Sends many emails at once (Resend batch API, 100 per request). Returns how many went out. */
export async function sendEmails(list: Mail[]): Promise<number> {
  if (list.length === 0) return 0;
  let delivered = 0;
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    let ok = !resend;
    if (resend) {
      const { error } = await resend.batch.send(
        chunk.map((m) => ({ from: EMAIL_FROM, to: m.to, subject: m.subject, html: render(m), text: toText(m) })),
      );
      if (error) console.error("Batch email failed", error);
      ok = !error;
    } else {
      for (const m of chunk) console.log(`\n✉️  [email not sent — no RESEND_API_KEY]\nTo: ${m.to}\nSubject: ${m.subject}\n${toText(m)}\n`);
    }
    if (ok) delivered += chunk.length;
    try {
      const db = await getDb();
      await db.insert(schema.emailLog).values(
        chunk.map((m) => ({ toEmail: m.to, toUserId: m.toUserId, subject: m.subject, kind: m.kind, sentById: m.sentById, delivered: ok && !!resend })),
      );
    } catch (e) {
      console.error("email log failed", e);
    }
  }
  return delivered;
}

/** Sends an email (or logs it to the terminal when RESEND_API_KEY is not set). */
export async function sendEmail(m: Mail): Promise<boolean> {
  const text = toText(m);
  let delivered = false;
  if (resend) {
    const { error } = await resend.emails.send({ from: EMAIL_FROM, to: m.to, subject: m.subject, html: render(m), text });
    if (error) console.error("Email failed", m.to, error);
    delivered = !error;
  } else {
    console.log(`\n✉️  [email not sent — no RESEND_API_KEY]\nTo: ${m.to}\nSubject: ${m.subject}\n${text}\n`);
  }
  try {
    const db = await getDb();
    await db.insert(schema.emailLog).values({
      toEmail: m.to,
      toUserId: m.toUserId,
      subject: m.subject,
      kind: m.kind,
      sentById: m.sentById,
      delivered,
    });
  } catch (e) {
    console.error("email log failed", e);
  }
  return delivered || !resend;
}
