ALTER TABLE "note_versions" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "title" text DEFAULT '' NOT NULL;