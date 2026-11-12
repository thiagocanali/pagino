CREATE SCHEMA "pagino_auth";
--> statement-breakpoint
CREATE SCHEMA "pagino";
--> statement-breakpoint
CREATE TABLE "pagino_auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagino_auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pagino_auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "pagino_auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagino"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagino"."institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institutions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "institutions_status_check" CHECK ("pagino"."institutions"."status" in ('active', 'suspended')),
	CONSTRAINT "institutions_slug_check" CHECK ("pagino"."institutions"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("pagino"."institutions"."slug") between 3 and 60)
);
--> statement-breakpoint
ALTER TABLE "pagino"."institutions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pagino"."memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_institution_user_unique" UNIQUE("institution_id","user_id"),
	CONSTRAINT "memberships_role_check" CHECK ("pagino"."memberships"."role" in ('owner','admin','editor','viewer')),
	CONSTRAINT "memberships_status_check" CHECK ("pagino"."memberships"."status" in ('active','revoked'))
);
--> statement-breakpoint
ALTER TABLE "pagino"."memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pagino"."pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_site_slug_unique" UNIQUE("site_id","slug"),
	CONSTRAINT "pages_tenant_id_unique" UNIQUE("institution_id","id"),
	CONSTRAINT "pages_version_check" CHECK ("pagino"."pages"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "pagino"."pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pagino"."sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"template_key" text DEFAULT 'institutional-classic' NOT NULL,
	"template_version" integer DEFAULT 1 NOT NULL,
	"draft_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_institution_id_unique" UNIQUE("institution_id"),
	CONSTRAINT "sites_tenant_id_unique" UNIQUE("institution_id","id"),
	CONSTRAINT "sites_versions_check" CHECK ("pagino"."sites"."template_version" > 0 and "pagino"."sites"."draft_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "pagino"."sites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pagino_auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "pagino_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagino_auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "pagino_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagino"."audit_logs" ADD CONSTRAINT "audit_logs_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "pagino"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagino"."audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "pagino_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagino"."memberships" ADD CONSTRAINT "memberships_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "pagino"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagino"."memberships" ADD CONSTRAINT "memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "pagino_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagino"."pages" ADD CONSTRAINT "pages_tenant_site_fk" FOREIGN KEY ("institution_id","site_id") REFERENCES "pagino"."sites"("institution_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagino"."sites" ADD CONSTRAINT "sites_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "pagino"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "pagino_auth"."account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "pagino_auth"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "pagino_auth"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "audit_tenant_created_index" ON "pagino"."audit_logs" USING btree ("institution_id","created_at","id");--> statement-breakpoint
CREATE INDEX "memberships_user_status_index" ON "pagino"."memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "pages_tenant_site_index" ON "pagino"."pages" USING btree ("institution_id","site_id");