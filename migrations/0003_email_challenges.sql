CREATE TABLE "pagino_auth"."email_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recipient" text NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"native_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"delivery_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_challenges_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "email_challenge_purpose" CHECK ("pagino_auth"."email_challenges"."purpose" in ('reset', 'verify')),
	CONSTRAINT "email_challenge_delivery" CHECK ("pagino_auth"."email_challenges"."delivery_status" in ('pending','sent','failed'))
);
--> statement-breakpoint
ALTER TABLE "pagino_auth"."email_challenges" ADD CONSTRAINT "email_challenges_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "pagino_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_challenge_expiry" ON "pagino_auth"."email_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "email_challenge_user_purpose" ON "pagino_auth"."email_challenges" USING btree ("user_id","purpose","used_at");
--> statement-breakpoint
REVOKE ALL ON pagino_auth.email_challenges FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON pagino_auth.email_challenges TO auth_runtime;
