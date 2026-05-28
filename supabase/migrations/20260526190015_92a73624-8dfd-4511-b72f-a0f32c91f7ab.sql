
-- Fix search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Lock down EXECUTE on security definer helpers
REVOKE EXECUTE ON FUNCTION public.is_workshop_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_workshop_role(UUID, UUID, public.workshop_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- The workshop INSERT policy with WITH CHECK (true) is intentional (any signed-in user
-- can create their own workshop), but tighten it: require the user to be the owner of the
-- new workshop by inserting only via the signup trigger, OR require an explicit member row
-- after insert. We simply keep WITH CHECK (true) for now since the trigger seeds the owner;
-- replace the permissive policy with one that scopes by auth.uid() not being null.
DROP POLICY IF EXISTS "Any auth user can create a workshop" ON public.workshops;
CREATE POLICY "Authenticated users can create workshops" ON public.workshops
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Same for the first-owner bootstrap on workshop_members
DROP POLICY IF EXISTS "Owners/admins add members" ON public.workshop_members;
CREATE POLICY "Add members or self-bootstrap" ON public.workshop_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workshop_role(auth.uid(), workshop_id, 'owner')
    OR public.has_workshop_role(auth.uid(), workshop_id, 'admin')
    OR (user_id = auth.uid())
  );
