CREATE OR REPLACE FUNCTION public.format_phone_in(raw text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN raw IS NULL OR btrim(raw) = '' THEN raw
    WHEN btrim(raw) LIKE '+%' THEN '+' || regexp_replace(raw, '[^0-9]', '', 'g')
    ELSE '+91' || regexp_replace(regexp_replace(raw, '[^0-9]', '', 'g'), '^(91(?=[0-9]{10}$)|0)', '')
  END
$$;

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  relationship text,
  phone text NOT NULL,
  type text NOT NULL CHECK (type IN ('family','shop','ambulance')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contacts TO anon, authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can add a contact" ON public.contacts FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS fallback_phone text;

CREATE OR REPLACE FUNCTION public.format_phone_trigger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.phone := public.format_phone_in(NEW.phone);
  IF TG_TABLE_NAME = 'requests' THEN
    NEW.fallback_phone := public.format_phone_in(NEW.fallback_phone);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER contacts_format_phone BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.format_phone_trigger();
CREATE TRIGGER requests_format_phone BEFORE INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.format_phone_trigger();