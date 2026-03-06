
-- Add user_id column to analyses table
ALTER TABLE public.analyses ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old permissive=No policies
DROP POLICY IF EXISTS "Allow public deletes on analyses" ON public.analyses;
DROP POLICY IF EXISTS "Allow public inserts on analyses" ON public.analyses;
DROP POLICY IF EXISTS "Allow public selects on analyses" ON public.analyses;

-- Create new RLS policies scoped to authenticated user
CREATE POLICY "Users can select own analyses"
  ON public.analyses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON public.analyses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON public.analyses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
