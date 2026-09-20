-- Remove broad public read access; status polling moves to a SECURITY DEFINER function that returns only the status for a known request id
DROP POLICY "Anyone can read care requests" ON public.requests;

-- Any authenticated user could tamper with any request; updates now require the service role (RLS bypass), e.g. staff tooling
DROP POLICY "Signed-in users can update care requests" ON public.requests;

-- Let the anonymous app poll only the status of a specific request id it created
CREATE OR REPLACE FUNCTION public.get_request_status(request_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.requests WHERE id = request_id
$$;

GRANT EXECUTE ON FUNCTION public.get_request_status(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_request_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_request_status(uuid) TO service_role;