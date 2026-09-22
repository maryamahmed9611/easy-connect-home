CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.notify_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE public.notify_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notify_config FROM anon, authenticated;
GRANT ALL ON public.notify_config TO service_role;

CREATE OR REPLACE FUNCTION public.notify_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  IF NEW."requestType" IS NULL OR NEW."requestType" NOT IN ('medical', 'groceries') THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_secret FROM public.notify_config WHERE key = 'twilio_notify_secret';
  SELECT value INTO v_url FROM public.notify_config WHERE key = 'notify_url';

  IF v_secret IS NULL OR v_url IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('request_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_request_created ON public.requests;

CREATE TRIGGER on_request_created
AFTER INSERT ON public.requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_request();