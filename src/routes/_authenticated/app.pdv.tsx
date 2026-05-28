import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShoppingCart, Search, Plus, Minus, Trash2, QrCode, CreditCard, Banknote, Receipt } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listEstoqueParaPDV, finalizarVenda } from "@/lib/pdv.functions";
import { listClientes } from "@/lib/clientes.functions";

export const Route = createFileRoute("/_authenticated/app/pdv")({ component: Page });

interface CartItem { id: string; nome: string; preco: number; qtd: number; estoque: number; }
type Produto = { id: string; nome: string; categoria: string | null; preco_venda: number; quantidade: number; unidade: string | null; codigo: string | null };

function Page() {
  const [busca, setBusca] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [formaPagamento, setFormaPagamento] = useState<"pix" | "dinheiro" | "cartao">("pix");
  const [clienteId, setClienteId] = useState<string>("");
  const qc = useQueryClient();

  const listEst = useServerFn(listEstoqueParaPDV);
  const finalizar = useServerFn(finalizarVenda);
  const listCli = useServerFn(listClientes);

  const { data: produtos = [] } = useQuery({ queryKey: ["pdv-estoque"], queryFn: () => listEst() });
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => listCli() });

  const catalogo = (produtos as Produto[]).filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.codigo ?? "").toLowerCase().includes(busca.toLowerCase()),
  );
  const total = cart.reduce((s, i) => s + i.preco * i.qtd, 0);

  const addToCart = (p: Produto) => {
    setCart(prev => {
      const ex = prev.find(x => x.id === p.id);
      if (ex) return prev.map(x => x.id === p.id ? { ...x, qtd: x.qtd + 1 } : x);
      return [...prev, { id: p.id, nome: p.nome, preco: Number(p.preco_venda), qtd: 1, estoque: Number(p.quantidade) }];
    });
  };
  const updateQtd = (id: string, delta: number) =>
    setCart(prev => prev.map(x => x.id === id ? { ...x, qtd: Math.max(1, x.qtd + delta) } : x).filter(x => x.qtd > 0));
  const removeItem = (id: string) => setCart(prev => prev.filter(x => x.id !== id));

  const mFinalizar = useMutation({
    mutationFn: () => finalizar({
      data: {
        cliente_id: clienteId || null,
        forma_pagamento: formaPagamento,
        itens: cart.map(c => ({ estoque_item_id: c.id, descricao: c.nome, quantidade: c.qtd, valor_unit: c.preco })),
      },
    }),
    onSuccess: (r: any) => {
      toast.success(`Venda finalizada — R$ ${Number(r.total).toFixed(2).replace(".", ",")}`);
      setCart([]); setClienteId("");
      qc.invalidateQueries({ queryKey: ["pdv-estoque"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <ShoppingCart className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">PDV</h1>
            <p className="text-sm text-muted-foreground mt-1">Venda rápida com baixa automática de estoque e lançamento financeiro.</p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto por nome ou código..." className="w-full rounded-xl border border-border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {catalogo.map((p, i) => (
              <motion.button key={p.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                onClick={() => addToCart(p)}
                className="glass rounded-2xl p-4 text-left hover:border-primary/40 transition group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{p.categoria ?? "Sem categoria"}</div>
                    <div className="mt-1 font-medium">{p.nome}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Estoque: {Number(p.quantidade)} {p.unidade ?? ""}</div>
                  </div>
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="mt-3 font-display text-lg font-semibold">R$ {Number(p.preco_venda).toFixed(2).replace(".", ",")}</div>
              </motion.button>
            ))}
            {catalogo.length === 0 && <div className="col-span-full text-center py-10 text-muted-foreground text-sm">Nenhum produto. Cadastre no Estoque.</div>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <h2 className="font-display text-lg font-semibold mb-4">Carrinho</h2>
            {cart.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Adicione produtos para iniciar a venda</div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.nome}</div>
                      <div className="text-xs text-muted-foreground">R$ {item.preco.toFixed(2).replace(".", ",")} un</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQtd(item.id, -1)} className="grid h-7 w-7 place-items-center rounded-md bg-secondary hover:bg-primary/20 transition"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center text-sm font-medium">{item.qtd}</span>
                      <button onClick={() => updateQtd(item.id, 1)} className="grid h-7 w-7 place-items-center rounded-md bg-secondary hover:bg-primary/20 transition"><Plus className="h-3 w-3" /></button>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="grid h-7 w-7 place-items-center rounded-md hover:bg-destructive/20 transition"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-border/60">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-2xl font-bold">R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-medium mb-3">Cliente (opcional)</h3>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Consumidor final</option>
              {(clientes as any[]).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-medium mb-3">Forma de pagamento</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "pix" as const, label: "PIX", icon: QrCode },
                { key: "dinheiro" as const, label: "Dinheiro", icon: Banknote },
                { key: "cartao" as const, label: "Cartão", icon: CreditCard },
              ].map(fp => (
                <button key={fp.key} onClick={() => setFormaPagamento(fp.key)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition ${formaPagamento === fp.key ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"}`}>
                  <fp.icon className="h-4 w-4" /> {fp.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => mFinalizar.mutate()} disabled={cart.length === 0 || mFinalizar.isPending} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_-4px_oklch(0.65_0.18_240/0.4)]">
            <Receipt className="inline h-4 w-4 mr-2" />
            {mFinalizar.isPending ? "Processando…" : "Finalizar venda"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
