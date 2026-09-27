DROP TRIGGER IF EXISTS notify_new_request_trigger ON public.requests;
DROP TRIGGER IF EXISTS on_request_insert ON public.requests;
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.requests'::regclass AND NOT tgisinternal
    AND pg_get_triggerdef(oid) ILIKE '%notify_new_request%' LOOP
    EXECUTE format('DROP TRIGGER %I ON public.requests', t.tgname);
  END LOOP;
END $$;