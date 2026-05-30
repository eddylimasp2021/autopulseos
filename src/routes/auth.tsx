import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "recovery">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/app", replace: true });
    });
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/app", replace: true }); });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: { full_name: name, workshop_name: workshop },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Confirme seu e-mail para entrar.");
        setMode("login");
      } else if (mode === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/auth",
        });
        if (error) throw error;
        toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
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
            <div className="font-display text-xl font-semibold">Garagem<span className="neon-text">OS</span></div>
            <div className="text-xs text-muted-foreground">{mode === "login" ? "Entre na sua oficina" : mode === "signup" ? "Crie sua oficina" : "Recuperar senha"}</div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label>Seu nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Nome da oficina</Label>
                <Input value={workshop} onChange={(e) => setWorkshop(e.target.value)} placeholder="Auto Center Silva" required />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode !== "recovery" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Senha</Label>
                {mode === "login" && (
                  <button type="button" onClick={() => setMode("recovery")} className="text-xs text-primary hover:underline">
                    Esqueci a senha
                  </button>
                )}
              </div>
              <Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full bg-[image:var(--gradient-neon)] text-neon-foreground hover:opacity-90 neon-border">
            {loading ? "..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta grátis" : "Enviar link de recuperação"}
          </Button>
        </form>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? "Não tem conta?" : mode === "signup" ? "Já tem conta?" : "Lembrou a senha?"}{" "}
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary hover:underline font-medium">
            {mode === "login" ? "Criar grátis" : "Voltar para Login"}
          </button>
        </div>
      </div>
    </div>
  );
}