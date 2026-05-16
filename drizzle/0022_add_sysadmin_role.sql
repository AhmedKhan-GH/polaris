DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sysadmin' AND enumtypid = 'public.user_role'::regtype) THEN
    ALTER TYPE "public"."user_role" ADD VALUE 'sysadmin' BEFORE 'owner';
  END IF;
END $$;