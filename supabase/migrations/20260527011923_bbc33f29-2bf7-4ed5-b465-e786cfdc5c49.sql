
-- 1) Fix privilege escalation in workshop_members self-bootstrap
DROP POLICY IF EXISTS "Add members or self-bootstrap" ON public.workshop_members;

CREATE POLICY "Admins add members"
ON public.workshop_members
FOR INSERT
TO authenticated
WITH CHECK (
  has_workshop_role(auth.uid(), workshop_id, 'owner'::workshop_role)
  OR has_workshop_role(auth.uid(), workshop_id, 'admin'::workshop_role)
);

CREATE POLICY "Self bootstrap as mecanico only"
ON public.workshop_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'mecanico'::workshop_role
);

-- 2) Lock down SECURITY DEFINER helper functions
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_workshop_role(uuid, uuid, public.workshop_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_workshop_member(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_workshop_role(uuid, uuid, public.workshop_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_workshop_member(uuid, uuid) TO service_role;
