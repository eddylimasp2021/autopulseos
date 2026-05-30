import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShoppingCart, Search, Plus, Minus, Trash2, QrCode, CreditCard, Banknote, Receipt, Package, User, Percent, Wallet } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listEstoqueParaPDV, finalizarVenda } from "@/lib/pdv.functions";
import { listClientes } from "@/lib/clientes.functions";

export const Route = createFileRoute("/_authenticated/app/pdv")({ component: Page });

interface CartItem { id: string; nome: string; preco: number; qtd: number; estoque: number; }
type Produto = { id: string; nome: string; categoria: string | null; preco_venda: number; quantidade: number; unidade: string | null; codigo: string | null };

type FormaPagamento = "pix" | "dinheiro" | "cartao_credito" | "cartao_debito";
const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

function Page() {
  const [busca, setBusca] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [clienteId, setClienteId] = useState<string>("");
  const [descontoStr, setDescontoStr] = useState("");
  const [recebidoStr, setRecebidoStr] = useState("");
  const [observacao, setObservacao] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const qc = useQueryClient();

  const listEst = useServerFn(listEstoqueParaPDV);
  const finalizar = useServerFn(finalizarVenda);
  const listCli = useServerFn(listClientes);

  const { data: produtos = [] } = useQuery({ queryKey: ["pdv-estoque"], queryFn: () => listEst() });
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => listCli() });

  const categorias = Array.from(new Set((produtos as Produto[]).map(p => p.categoria).filter(Boolean) as string[]));
  const catalogo = (produtos as Produto[]).filter(p => {
    const q = busca.toLowerCase().trim();
    const matchBusca = !q || p.nome.toLowerCase().includes(q) || (p.codigo ?? "").toLowerCase().includes(q);
    const matchCat = categoriaFiltro === "todas" || p.categoria === categoriaFiltro;
    return matchBusca && matchCat;
  });
  const subtotal = cart.reduce((s, i) => s + i.preco * i.qtd, 0);
  const desconto = Math.min(subtotal, Math.max(0, Number(descontoStr.replace(",", ".")) || 0));
  const total = Math.max(0, subtotal - desconto);
  const totalItens = cart.reduce((s, i) => s + i.qtd, 0);
  const recebido = Number(recebidoStr.replace(",", ".")) || 0;
  const troco = formaPagamento === "dinheiro" ? Math.max(0, recebido - total) : 0;
  const faltaReceber = formaPagamento === "dinheiro" ? Math.max(0, total - recebido) : 0;

  const addToCart = (p: Produto) => {
    if (Number(p.quantidade) <= 0) {
      toast.error(`${p.nome} sem estoque disponível`);
      return;
    }
    setCart(prev => {
      const ex = prev.find(x => x.id === p.id);
      if (ex) {
        if (ex.qtd + 1 > ex.estoque) {
          toast.error(`Estoque máximo de ${ex.estoque} para ${ex.nome}`);
          return prev;
        }
        return prev.map(x => x.id === p.id ? { ...x, qtd: x.qtd + 1 } : x);
      }
      return [...prev, { id: p.id, nome: p.nome, preco: Number(p.preco_venda), qtd: 1, estoque: Number(p.quantidade) }];
    });
  };
  const updateQtd = (id: string, delta: number) =>
    setCart(prev => prev.map(x => {
      if (x.id !== id) return x;
      const next = Math.max(1, x.qtd + delta);
      if (next > x.estoque) { toast.error(`Estoque máximo de ${x.estoque}`); return x; }
      return { ...x, qtd: next };
    }));
  const removeItem = (id: string) => setCart(prev => prev.filter(x => x.id !== id));
  const limparCarrinho = () => { setCart([]); setDescontoStr(""); setRecebidoStr(""); setObservacao(""); };

  const mFinalizar = useMutation({
    mutationFn: () => finalizar({
      data: {
        cliente_id: clienteId || null,
        forma_pagamento: formaPagamento,
        desconto,
        valor_recebido: formaPagamento === "dinheiro" ? recebido : null,
        observacao: observacao || null,
        itens: cart.map(c => ({ estoque_item_id: c.id, descricao: c.nome, quantidade: c.qtd, valor_unit: c.preco })),
      },
    }),
    onSuccess: (r: any) => {
      const trocoMsg = r.troco > 0 ? ` • Troco ${brl(Number(r.troco))}` : "";
      toast.success(`Venda finalizada — ${brl(Number(r.total))}${trocoMsg}`);
      limparCarrinho(); setClienteId("");
      qc.invalidateQueries({ queryKey: ["pdv-estoque"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const podeFinalizar =
    cart.length > 0 &&
    !mFinalizar.isPending &&
    total > 0 &&
    (formaPagamento !== "dinheiro" || recebido >= total);

  const pagamentos: { key: FormaPagamento; label: string; icon: typeof QrCode; hint?: string }[] = [
    { key: "pix", label: "PIX", icon: QrCode, hint: "Aprovação imediata" },
    { key: "dinheiro", label: "Dinheiro", icon: Banknote, hint: "Calcula troco" },
    { key: "cartao_credito", label: "Crédito", icon: CreditCard, hint: "Cartão de crédito" },
    { key: "cartao_debito", label: "Débito", icon: Wallet, hint: "Cartão de débito" },
  ];

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
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-secondary/50 border border-border/60 px-3 py-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Itens no carrinho</span>
            <span className="text-sm font-semibold tabular-nums">{totalItens}</span>
          </div>
          {cart.length > 0 && (
            <button onClick={limparCarrinho} className="text-xs text-muted-foreground hover:text-destructive transition px-3 py-2 rounded-xl border border-border/60 hover:border-destructive/40">
              Limpar venda
            </button>
          )}
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto por nome ou código..." className="w-full rounded-xl border border-border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCategoriaFiltro("todas")}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${categoriaFiltro === "todas" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"}`}>
                Todas
              </button>
              {categorias.map(c => (
                <button key={c} onClick={() => setCategoriaFiltro(c)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${categoriaFiltro === c ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"}`}>
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {catalogo.map((p, i) => (
              <motion.button key={p.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                onClick={() => addToCart(p)}
                disabled={Number(p.quantidade) <= 0}
                className="glass rounded-2xl p-4 text-left hover:border-primary/40 transition group disabled:opacity-50 disabled:cursor-not-allowed">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{p.categoria ?? "Sem categoria"}</div>
                    <div className="mt-1 font-medium">{p.nome}</div>
                    <div className="text-xs mt-0.5 flex items-center gap-1.5">
                      <span className={`inline-flex h-1.5 w-1.5 rounded-full ${Number(p.quantidade) <= 0 ? "bg-destructive" : Number(p.quantidade) < 5 ? "bg-amber-500" : "bg-emerald-500"}`} />
                      <span className="text-muted-foreground">{Number(p.quantidade)} {p.unidade ?? ""} em estoque</span>
                    </div>
                    {p.codigo && <div className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">#{p.codigo}</div>}
                  </div>
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="mt-3 font-display text-lg font-semibold tabular-nums">{brl(Number(p.preco_venda))}</div>
              </motion.button>
            ))}
            {catalogo.length === 0 && (
              <div className="col-span-full glass rounded-2xl py-12 text-center text-sm text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                {busca || categoriaFiltro !== "todas" ? "Nenhum produto encontrado com esses filtros." : "Nenhum produto cadastrado. Cadastre no módulo Estoque."}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="space-y-4 lg:sticky lg:top-6 self-start max-h-[calc(100vh-2rem)] overflow-y-auto styled-scrollbar pr-2 pb-6">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Carrinho</h2>
              <span className="text-xs text-muted-foreground tabular-nums">{totalItens} {totalItens === 1 ? "item" : "itens"}</span>
            </div>
            {cart.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Adicione produtos para iniciar a venda
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3 hover:bg-secondary/60 transition">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.nome}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {brl(item.preco)} × {item.qtd} = <span className="text-foreground font-medium">{brl(item.preco * item.qtd)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQtd(item.id, -1)} className="grid h-7 w-7 place-items-center rounded-md bg-secondary hover:bg-primary/20 transition"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center text-sm font-medium tabular-nums">{item.qtd}</span>
                      <button onClick={() => updateQtd(item.id, 1)} className="grid h-7 w-7 place-items-center rounded-md bg-secondary hover:bg-primary/20 transition"><Plus className="h-3 w-3" /></button>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="grid h-7 w-7 place-items-center rounded-md hover:bg-destructive/20 transition"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{brl(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <label className="text-muted-foreground inline-flex items-center gap-1.5">
                    <Percent className="h-3 w-3" /> Desconto
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={descontoStr}
                      onChange={e => setDescontoStr(e.target.value)}
                      placeholder="0,00"
                      className="w-28 rounded-md border border-input bg-background pl-8 pr-2 py-1.5 text-sm text-right tabular-nums outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/40">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-display text-2xl font-bold tabular-nums text-primary">{brl(total)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-medium mb-3 inline-flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" /> Cliente <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </h3>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Consumidor final</option>
              {(clientes as any[]).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-medium mb-3">Forma de pagamento</h3>
            <div className="grid grid-cols-2 gap-2">
              {pagamentos.map(fp => (
                <button key={fp.key} onClick={() => setFormaPagamento(fp.key)} type="button"
                  className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-xs font-medium transition ${formaPagamento === fp.key ? "border-primary bg-primary/10 text-primary shadow-[0_0_16px_-6px_oklch(0.65_0.18_240/0.5)]" : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                  <fp.icon className="h-4 w-4" />
                  <span>{fp.label}</span>
                  {fp.hint && <span className="text-[10px] opacity-70 font-normal">{fp.hint}</span>}
                </button>
              ))}
            </div>

            {formaPagamento === "dinheiro" && cart.length > 0 && (
              <div className="mt-4 space-y-2 pt-3 border-t border-border/40">
                <label className="text-xs text-muted-foreground">Valor recebido</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={recebidoStr}
                    onChange={e => setRecebidoStr(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-right tabular-nums outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div className="flex justify-between text-xs pt-1">
                  {faltaReceber > 0 ? (
                    <>
                      <span className="text-amber-500">Falta receber</span>
                      <span className="font-semibold tabular-nums text-amber-500">{brl(faltaReceber)}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground">Troco</span>
                      <span className="font-semibold tabular-nums text-emerald-500">{brl(troco)}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {cart.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/40">
                <label className="text-xs text-muted-foreground">Observação (opcional)</label>
                <input
                  type="text"
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  maxLength={500}
                  placeholder="Ex.: nota fiscal, parcelamento..."
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            )}
          </div>

          <button onClick={() => mFinalizar.mutate()} disabled={!podeFinalizar} className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_24px_-4px_oklch(0.65_0.18_240/0.5)] flex items-center justify-center gap-2">
            <Receipt className="h-4 w-4" />
            {mFinalizar.isPending ? "Processando…" : cart.length === 0 ? "Adicione produtos" : `Finalizar — ${brl(total)}`}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
