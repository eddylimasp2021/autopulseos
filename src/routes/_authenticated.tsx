import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app/AppSidebar";
import { Topbar } from "@/components/app/Topbar";
import { AppFooter } from "@/components/app/AppFooter";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const getAuthenticatedLayoutData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    return {
      userId,
      fullName: profile?.full_name ?? claims.user_metadata?.full_name ?? null,
    };
  });

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  loader: () => getAuthenticatedLayoutData(),
  component: AuthLayout,
  errorComponent: AuthLayoutError,
  notFoundComponent: AuthLayoutNotFound,
});

function AuthLayout() {
  const { user } = Route.useRouteContext();
  const { fullName } = Route.useLoaderData();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={fullName ?? user.user_metadata?.full_name} />
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  );
}

function AuthLayoutError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Não foi possível validar sua sessão</h1>
        <p className="text-sm text-muted-foreground">
          Tente novamente para recarregar seus dados com segurança.
        </p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

function AuthLayoutNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold text-foreground">Área não encontrada</h1>
        <p className="text-sm text-muted-foreground">
          A página protegida que você tentou abrir não existe mais.
        </p>
      </div>
    </div>
  );
}
