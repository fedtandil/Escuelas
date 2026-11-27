ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_login_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;

CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR auth.uid() = 'f7435bbd-5b4d-4296-b6ce-c24db1edad2e'::uuid
);

REVOKE SELECT ON TABLE public.profiles FROM anon, authenticated;
REVOKE SELECT (
  id, nombre, apellido, telefono, mail, "contraseña", role, created_at, updated_at
) ON TABLE public.profiles FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT (id, nombre, apellido, mail, role)
ON TABLE public.profiles TO authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.login_profile(text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.login_profile(text,text) FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;
