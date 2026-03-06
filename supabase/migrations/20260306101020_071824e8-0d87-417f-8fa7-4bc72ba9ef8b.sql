
CREATE POLICY "Allow public deletes on analyses"
ON public.analyses
FOR DELETE
TO anon, authenticated
USING (true);
