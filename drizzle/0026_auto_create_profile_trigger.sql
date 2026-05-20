DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        INSERT INTO profiles (id, email, role)
        VALUES (NEW.id, NEW.email, 'member')
        ON CONFLICT (id) DO NOTHING;
        RETURN NEW;
      END;
      $body$;
    $fn$;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
    ) THEN
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
  END IF;
END $$;
