
CREATE POLICY "Allow public inserts on analyses"
ON public.analyses
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow public selects on analyses"
ON public.analyses
FOR SELECT
TO anon, authenticated
USING (true);
