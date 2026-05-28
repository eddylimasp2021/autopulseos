
-- Plans enum
CREATE TYPE public.workshop_plan AS ENUM ('trial', 'basico', 'profissional', 'premium');
CREATE TYPE public.workshop_role AS ENUM ('owner', 'admin', 'mecanico', 'atendente');

-- Workshops (tenants)
CREATE TABLE public.workshops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  plan public.workshop_plan NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshops TO authenticated;
GRANT ALL ON public.workshops TO service_role;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Workshop members
CREATE TABLE public.workshop_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.workshop_role NOT NULL DEFAULT 'mecanico',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_members TO authenticated;
GRANT ALL ON public.workshop_members TO service_role;
ALTER TABLE public.workshop_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_workshop_members_user ON public.workshop_members(user_id);
CREATE INDEX idx_workshop_members_workshop ON public.workshop_members(workshop_id);

-- Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_workshop_member(_user_id UUID, _workshop_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workshop_members
    WHERE user_id = _user_id AND workshop_id = _workshop_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workshop_role(_user_id UUID, _workshop_id UUID, _role public.workshop_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workshop_members
    WHERE user_id = _user_id AND workshop_id = _workshop_id AND role = _role
  );
$$;

-- RLS: workshops
CREATE POLICY "Members can view their workshops" ON public.workshops
  FOR SELECT TO authenticated
  USING (public.is_workshop_member(auth.uid(), id));

CREATE POLICY "Any auth user can create a workshop" ON public.workshops
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Owners/admins update their workshop" ON public.workshops
  FOR UPDATE TO authenticated
  USING (public.has_workshop_role(auth.uid(), id, 'owner') OR public.has_workshop_role(auth.uid(), id, 'admin'));

CREATE POLICY "Owners delete their workshop" ON public.workshops
  FOR DELETE TO authenticated
  USING (public.has_workshop_role(auth.uid(), id, 'owner'));

-- RLS: profiles
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- RLS: workshop_members
CREATE POLICY "Members view members of their workshops" ON public.workshop_members
  FOR SELECT TO authenticated
  USING (public.is_workshop_member(auth.uid(), workshop_id));

CREATE POLICY "Owners/admins add members" ON public.workshop_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workshop_role(auth.uid(), workshop_id, 'owner')
    OR public.has_workshop_role(auth.uid(), workshop_id, 'admin')
    OR NOT EXISTS (SELECT 1 FROM public.workshop_members WHERE workshop_id = workshop_members.workshop_id)
  );

CREATE POLICY "Owners/admins update members" ON public.workshop_members
  FOR UPDATE TO authenticated
  USING (public.has_workshop_role(auth.uid(), workshop_id, 'owner') OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'));

CREATE POLICY "Owners/admins remove members" ON public.workshop_members
  FOR DELETE TO authenticated
  USING (public.has_workshop_role(auth.uid(), workshop_id, 'owner') OR public.has_workshop_role(auth.uid(), workshop_id, 'admin'));

-- Auto-create profile + workshop trial on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_workshop_id UUID;
  workshop_slug TEXT;
  user_full_name TEXT;
BEGIN
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, user_full_name);

  workshop_slug := 'oficina-' || substr(replace(NEW.id::text, '-', ''), 1, 8);

  INSERT INTO public.workshops (name, slug)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'workshop_name', 'Minha Oficina'), workshop_slug)
  RETURNING id INTO new_workshop_id;

  INSERT INTO public.workshop_members (workshop_id, user_id, role)
  VALUES (new_workshop_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER workshops_updated_at BEFORE UPDATE ON public.workshops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
