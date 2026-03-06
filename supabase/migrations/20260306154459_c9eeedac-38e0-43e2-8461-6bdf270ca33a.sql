
-- Drop auth-only policies
DROP POLICY IF EXISTS "Users can select own analyses" ON public.analyses;
DROP POLICY IF EXISTS "Users can insert own analyses" ON public.analyses;
DROP POLICY IF EXISTS "Users can delete own analyses" ON public.analyses;

-- Create permissive policies that work with or without auth
CREATE POLICY "Allow all selects on analyses"
  ON public.analyses FOR SELECT
  USING (true);

CREATE POLICY "Allow all inserts on analyses"
  ON public.analyses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all deletes on analyses"
  ON public.analyses FOR DELETE
  USING (true);
