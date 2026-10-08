import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["ambassador", "manager", "admin"]);

// tour / event / hs_visit count toward requirements. "calendar" = info only (Outlook, meetings, trainings).
export const eventTypeEnum = pgEnum("event_type", ["tour", "event", "hs_visit", "calendar"]);
export const eventSourceEnum = pgEnum("event_source", ["app", "outlook"]);
export const signupStatusEnum = pgEnum("signup_status", ["going", "no_show"]);

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  managerId: uuid("manager_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: roleEnum("role").notNull().default("ambassador"),
    teamId: uuid("team_id").references((): AnyPgColumn => teams.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    // Secret used for the personal calendar feed URL (/api/calendar/<token>.ics)
    calendarToken: text("calendar_token").notNull(),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_calendar_token_idx").on(t.calendarToken),
  ],
);

export const semesters = pgTable("semesters", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  reqTours: integer("req_tours").notNull().default(7),
  reqEvents: integer("req_events").notNull().default(6),
  reqHsVisits: integer("req_hs_visits").notNull().default(4),
  reqHsVisitsAc: integer("req_hs_visits_ac").notNull().default(2),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    type: eventTypeEnum("type").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    location: text("location"),
    notes: text("notes"),
    // null = no sign-up (info only). Number = how many ambassadors are needed.
    spots: integer("spots"),
    // High school visit with an admissions counselor (AC)
    withAc: boolean("with_ac").notNull().default(false),
    source: eventSourceEnum("source").notNull().default("app"),
    // Outlook UID (+ instance time) so sync can update instead of duplicating
    externalId: text("external_id"),
    // Shared by events created together with "repeat weekly"
    seriesId: uuid("series_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_starts_at_idx").on(t.startsAt),
    uniqueIndex("events_external_id_idx").on(t.externalId),
  ],
);

export const signups = pgTable(
  "signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: signupStatusEnum("status").notNull().default("going"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("signups_event_user_idx").on(t.eventId, t.userId), index("signups_user_idx").on(t.userId)],
);

// Sign-in emails contain a link AND a 6-digit code (codes survive Outlook link scanners
// and let people sign in on a different device than the one that got the email).
export const loginTokens = pgTable("login_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  codeHash: text("code_hash").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Simple key/value settings editable by admins (Outlook link, automatic reminders, ...)
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const emailLog = pgTable("email_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  toUserId: uuid("to_user_id").references(() => users.id, { onDelete: "cascade" }),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  kind: text("kind").notNull(), // login | reminder | shift | nudge
  sentById: uuid("sent_by_id").references(() => users.id, { onDelete: "set null" }),
  delivered: boolean("delivered").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Semester = typeof semesters.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Signup = typeof signups.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type EventType = (typeof eventTypeEnum.enumValues)[number];
