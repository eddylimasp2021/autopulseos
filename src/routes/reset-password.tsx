import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Redefinir senha | GaragemOS" },
      { name: "description", content: "Defina uma nova senha para acessar sua oficina no GaragemOS." },
      { property: "og:title", content: "Redefinir senha | GaragemOS" },
      { property: "og:description", content: "Defina uma nova senha para acessar sua oficina no GaragemOS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && (event === "PASSWORD_RECOVERY" || session)) setStatus("ready");
    });

    const clean = () => window.history.replaceState({}, "", "/reset-password");

    async function validateRecoveryLink() {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      // 1) PKCE / código na query
      const code = search.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (!error) { clean(); setStatus("ready"); return; }
      }

      // 2) Tokens no fragmento (#access_token=...&type=recovery)
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!active) return;
        if (!error) { clean(); setStatus("ready"); return; }
      }

      // 3) Link com token_hash (verificação por OTP)
      const token_hash = search.get("token_hash") ?? hash.get("token_hash");
      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash });
        if (!active) return;
        if (!error) { clean(); setStatus("ready"); return; }
      }

      // 4) Sessão já estabelecida (pode demorar alguns ciclos no preview)
      for (let i = 0; i < 8; i++) {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session) { setStatus("ready"); return; }
        await new Promise((r) => setTimeout(r, 400));
      }
      if (active) setStatus("invalid");
    }

    void validateRecoveryLink();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-background p-6">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
      <div className="relative w-full max-w-md glass-strong rounded-2xl p-8 shadow-[var(--shadow-elegant)]">
        <div className="flex items-center gap-3 mb-8">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <Zap className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">Garagem<span className="neon-text">OS</span></h1>
            <div className="text-xs text-muted-foreground">Definir nova senha</div>
          </div>
        </div>

        {status === "checking" ? (
          <p className="text-sm text-muted-foreground">Validando seu link de recuperação...</p>
        ) : status === "invalid" ? (
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Este link de recuperação é inválido ou expirou.</p>
            <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/auth" })}>
              Voltar para o login
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-[image:var(--gradient-neon)] text-neon-foreground hover:opacity-90 neon-border">
              {loading ? "..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
