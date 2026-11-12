CREATE TABLE "pagino_auth"."rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);

--> statement-breakpoint
REVOKE ALL ON pagino_auth.rate_limit FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON pagino_auth.rate_limit TO auth_runtime;
