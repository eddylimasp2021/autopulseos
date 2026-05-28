import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Zap, ArrowRight, Sparkles, Shield, Bot } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-hero)" }} />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-neon)] neon-border">
            <Zap className="h-4 w-4 text-neon-foreground" />
          </div>
          <span className="font-display text-lg font-semibold">Garagem<span className="neon-text">OS</span></span>
        </div>
        <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-[image:var(--gradient-neon)] px-5 py-2 text-sm font-medium text-neon-foreground neon-border hover:opacity-90 transition">
          Entrar <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 text-center lg:py-32">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground mb-8">
          <Sparkles className="h-3 w-3 text-primary" /> Nova geração de gestão automotiva
        </div>
        <h1 className="font-display text-5xl font-semibold tracking-tight lg:text-7xl">
          A oficina do futuro <br />
          <span className="neon-text">roda em GaragemOS</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground lg:text-lg">
          Plataforma all-in-one com OS digital, troca de óleo automatizada, PDV, financeiro,
          WhatsApp e IA — tudo em um sistema rápido, bonito e feito para escalar.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-[image:var(--gradient-neon)] px-6 py-3 text-sm font-semibold text-neon-foreground neon-border hover:opacity-90 transition">
            Começar trial grátis <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#features" className="inline-flex items-center gap-2 rounded-full glass px-6 py-3 text-sm font-medium hover:border-primary/40 transition">
            Ver recursos
          </a>
        </div>

        <div id="features" className="mt-24 grid gap-5 sm:grid-cols-3 text-left">
          {[
            { icon: Bot, title: "IA integrada", desc: "Orçamentos, previsões e atendimento automático." },
            { icon: Sparkles, title: "WhatsApp nativo", desc: "Cobrança, lembretes e aprovação em um clique." },
            { icon: Shield, title: "Multi-tenant seguro", desc: "Dados isolados por oficina com RLS." },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/80 border border-border/60 mb-4">
                <f.icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
