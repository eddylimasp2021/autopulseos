
-- Drop existing trigger + function that hardcoded the privileged email
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
DROP TRIGGER IF EXISTS assign_super_admin_on_signup ON auth.users;
DROP FUNCTION IF EXISTS public.assign_super_admin_on_signup();

-- Replacement: assign default 'user' role to every new signup, no hardcoded admins
CREATE OR REPLACE FUNCTION public.assign_default_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_default_user_role() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_default_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_user_role();
