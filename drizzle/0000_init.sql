CREATE TYPE "public"."event_source" AS ENUM('app', 'outlook');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('tour', 'event', 'hs_visit', 'calendar');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ambassador', 'manager', 'admin');--> statement-breakpoint
CREATE TYPE "public"."signup_status" AS ENUM('going', 'no_show');--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_user_id" uuid,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"kind" text NOT NULL,
	"sent_by_id" uuid,
	"delivered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" "event_type" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"location" text,
	"notes" text,
	"spots" integer,
	"with_ac" boolean DEFAULT false NOT NULL,
	"source" "event_source" DEFAULT 'app' NOT NULL,
	"external_id" text,
	"series_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semesters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"req_tours" integer DEFAULT 7 NOT NULL,
	"req_events" integer DEFAULT 6 NOT NULL,
	"req_hs_visits" integer DEFAULT 4 NOT NULL,
	"req_hs_visits_ac" integer DEFAULT 2 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "signup_status" DEFAULT 'going' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"manager_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" DEFAULT 'ambassador' NOT NULL,
	"team_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"calendar_token" text NOT NULL,
	"onboarded_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signups" ADD CONSTRAINT "signups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signups" ADD CONSTRAINT "signups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_external_id_idx" ON "events" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signups_event_user_idx" ON "signups" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "signups_user_idx" ON "signups" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_calendar_token_idx" ON "users" USING btree ("calendar_token");