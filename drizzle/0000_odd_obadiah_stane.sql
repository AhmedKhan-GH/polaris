CREATE TABLE "sign_in_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" bigint NOT NULL
);

ALTER TABLE "sign_in_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own sign-in logs"
  ON "sign_in_log" FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
