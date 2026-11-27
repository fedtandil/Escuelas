-- Ejecutar una vez en Supabase SQL Editor después de confirmar el UUID
-- en Authentication > Users.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = 'f7435bbd-5b4d-4296-b6ce-c24db1edad2e'::uuid
  ) THEN
    RAISE EXCEPTION 'No existe ese usuario en auth.users. Verificá el UUID antes de continuar.';
  END IF;

  INSERT INTO public.profiles (id, mail, role, created_at, updated_at)
  SELECT id, email, FALSE, COALESCE(created_at, NOW()), NOW()
  FROM auth.users
  WHERE id = 'f7435bbd-5b4d-4296-b6ce-c24db1edad2e'::uuid
  ON CONFLICT (id) DO UPDATE
  SET mail = EXCLUDED.mail,
      updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = 'f7435bbd-5b4d-4296-b6ce-c24db1edad2e'::uuid;
$$;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin()
);

CREATE OR REPLACE FUNCTION public.admin_list_fed_profiles(
  p_admin_mail TEXT,
  p_admin_password TEXT
)
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.profiles p
  WHERE p.role = TRUE
    AND EXISTS (
      SELECT 1
      FROM public.profiles admin
      WHERE admin.id = 'f7435bbd-5b4d-4296-b6ce-c24db1edad2e'::uuid
        AND lower(admin.mail) = lower(trim(p_admin_mail))
        AND admin.contraseña = p_admin_password
    );
$$;

CREATE OR REPLACE FUNCTION public.admin_enable_fed_profile(
  p_admin_mail TEXT,
  p_admin_password TEXT,
  p_mail TEXT,
  p_nombre TEXT,
  p_apellido TEXT,
  p_password TEXT
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.profiles;
  existing_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles admin
    WHERE admin.id = 'f7435bbd-5b4d-4296-b6ce-c24db1edad2e'::uuid
      AND lower(admin.mail) = lower(trim(p_admin_mail))
      AND admin.contraseña = p_admin_password
  ) THEN
    RAISE EXCEPTION 'Solo el administrador puede crear cuentas F.E.D.';
  END IF;

  SELECT id INTO existing_id
  FROM public.profiles
  WHERE lower(mail) = lower(trim(p_mail));

  IF existing_id IS NOT NULL THEN
    UPDATE public.profiles
    SET nombre = NULLIF(trim(p_nombre), ''),
        apellido = NULLIF(trim(p_apellido), ''),
        contraseña = p_password,
        role = TRUE,
        updated_at = NOW()
    WHERE id = existing_id
    RETURNING * INTO saved;
  ELSE
    INSERT INTO public.profiles (
      id, nombre, apellido, mail, contraseña, role, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      NULLIF(trim(p_nombre), ''),
      NULLIF(trim(p_apellido), ''),
      lower(trim(p_mail)),
      p_password,
      TRUE,
      NOW(),
      NOW()
    )
    RETURNING * INTO saved;
  END IF;

  RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_fed_profile_role(
  p_admin_mail TEXT,
  p_admin_password TEXT,
  p_profile_id UUID,
  p_role BOOLEAN
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.profiles;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles admin
    WHERE admin.id = 'f7435bbd-5b4d-4296-b6ce-c24db1edad2e'::uuid
      AND lower(admin.mail) = lower(trim(p_admin_mail))
      AND admin.contraseña = p_admin_password
  ) THEN
    RAISE EXCEPTION 'Solo el administrador puede modificar cuentas F.E.D.';
  END IF;

  UPDATE public.profiles
  SET role = COALESCE(p_role, FALSE), updated_at = NOW()
  WHERE id = p_profile_id
  RETURNING * INTO saved;

  IF saved.id IS NULL THEN
    RAISE EXCEPTION 'No existe el perfil solicitado.';
  END IF;

  RETURN saved;
END;
$$;

NOTIFY pgrst, 'reload schema';
