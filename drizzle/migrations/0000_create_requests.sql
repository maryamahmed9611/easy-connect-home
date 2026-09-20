CREATE TABLE public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  "requestType" text,
  details text,
  phone text,
  status text NOT NULL DEFAULT 'pending',
  "timestamp" timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a care request"
  ON public.requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read care requests"
  ON public.requests FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Signed-in users can update care requests"
  ON public.requests FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);