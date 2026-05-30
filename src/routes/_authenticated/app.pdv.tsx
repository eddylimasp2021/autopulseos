import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShoppingCart, Search, Plus, Minus, Trash2, QrCode, CreditCard, Banknote, Receipt, Package, User, Percent, Wallet, LogOut, Keyboard } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listEstoqueParaPDV, finalizarVenda, verificarCaixaAberto, abrirCaixa, fecharCaixa } from "@/lib/pdv.functions";
import { listClientes } from "@/lib/clientes.functions";
import { imprimirCupomNaoFiscal, imprimirAberturaCaixa, imprimirFechamentoCaixa } from "@/lib/print";

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
  const buscaRef = useRef<HTMLInputElement>(null);
  const descontoRef = useRef<HTMLInputElement>(null);

  const listEst = useServerFn(listEstoqueParaPDV);
  const finalizar = useServerFn(finalizarVenda);
  const listCli = useServerFn(listClientes);
  
  // Funções de Caixa
  const vCaixa = useServerFn(verificarCaixaAberto);
  const mAbrirCaixa = useServerFn(abrirCaixa);
  const mFecharCaixa = useServerFn(fecharCaixa);

  const { data: produtos = [] } = useQuery({ queryKey: ["pdv-estoque"], queryFn: () => listEst() });
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => listCli() });
  const { data: caixaAtual, isLoading: loadingCaixa } = useQuery({ queryKey: ["pdv-caixa"], queryFn: () => vCaixa() });

  const [saldoAbertura, setSaldoAbertura] = useState("");
  const [modalFechamento, setModalFechamento] = useState(false);

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

  const mAbrir = useMutation({
    mutationFn: () => mAbrirCaixa({ data: { saldo_abertura: Number(saldoAbertura.replace(",", ".")) || 0 } }),
    onSuccess: (caixa) => {
      toast.success("Caixa aberto com sucesso!");
      imprimirAberturaCaixa(caixa.operador_nome, Number(caixa.saldo_abertura));
      qc.invalidateQueries({ queryKey: ["pdv-caixa"] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const mFechar = useMutation({
    mutationFn: () => mFecharCaixa({ data: { caixa_id: caixaAtual?.id! } }),
    onSuccess: (resumo) => {
      toast.success("Caixa fechado com sucesso!");
      imprimirFechamentoCaixa({
        operador: resumo.operador_nome,
        dataAbertura: resumo.data_abertura,
        saldoInicial: Number(resumo.saldo_abertura),
        dinheiro: resumo.resumo.dinheiro,
        pix: resumo.resumo.pix,
        credito: resumo.resumo.credito,
        debito: resumo.resumo.debito,
        totalVendas: resumo.resumo.total_vendas,
        saldoFinal: Number(resumo.saldo_abertura) + resumo.resumo.dinheiro
      });
      qc.invalidateQueries({ queryKey: ["pdv-caixa"] });
      setModalFechamento(false);
      limparCarrinho();
    },
    onError: (e: Error) => toast.error(e.message)
  });

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
        caixa_id: caixaAtual?.id!,
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
      
      imprimirCupomNaoFiscal({
        itens: cart,
        subtotal: subtotal,
        desconto: desconto,
        total: r.total,
        formaPagamento: formaPagamento,
        recebido: recebido,
        troco: r.troco,
        observacao: observacao,
        data: new Date().toLocaleString("pt-BR"),
        operador: caixaAtual?.operador_nome
      });

      limparCarrinho(); setClienteId("");
      qc.invalidateQueries({ queryKey: ["pdv-estoque"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loadingCaixa) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando módulo PDV...</div>;
  }

  if (!caixaAtual) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center max-w-sm w-full">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-[image:var(--gradient-neon)] neon-border mb-6">
            <Banknote className="h-10 w-10 text-neon-foreground" />
          </div>
          <h2 className="text-3xl font-display font-bold">Caixa Fechado</h2>
          <p className="text-muted-foreground mt-2 text-center">Para iniciar as vendas, você precisa abrir o caixa do dia informando o fundo de troco.</p>
          
          <div className="glass p-6 rounded-3xl w-full mt-8 space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground">Fundo de Troco Inicial (R$)</label>
              <input 
                autoFocus
                type="text" 
                inputMode="decimal"
                value={saldoAbertura} 
                onChange={e => setSaldoAbertura(e.target.value)}
                placeholder="Ex: 50,00"
                className="mt-2 w-full rounded-xl border border-input bg-background/50 px-4 py-3 text-lg tabular-nums outline-none focus:ring-2 focus:ring-primary/40 transition"
              />
            </div>
            <button 
              onClick={() => mAbrir.mutate()}
              disabled={mAbrir.isPending}
              className="w-full rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition shadow-[0_0_24px_-4px_oklch(0.65_0.18_240/0.5)] flex items-center justify-center gap-2"
            >
              <Banknote className="h-5 w-5" />
              {mAbrir.isPending ? "Processando..." : "Abrir Caixa"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const podeFinalizar = cart.length > 0 && !mFinalizar.isPending && total > 0 && (formaPagamento !== "dinheiro" || recebido >= total);

  const pagamentos: { key: FormaPagamento; label: string; icon: typeof QrCode; hint?: string }[] = [
    { key: "pix", label: "PIX", icon: QrCode, hint: "Atalho F3" },
    { key: "dinheiro", label: "Dinheiro", icon: Banknote, hint: "Atalho F4" },
    { key: "cartao_credito", label: "Crédito", icon: CreditCard, hint: "Atalho F5" },
    { key: "cartao_debito", label: "Débito", icon: Wallet, hint: "Atalho F6" },
  ];

  useEffect(() => {
    if (!caixaAtual) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); buscaRef.current?.focus(); }
      else if (e.key === "F3") { e.preventDefault(); setFormaPagamento("pix"); }
      else if (e.key === "F4") { e.preventDefault(); setFormaPagamento("dinheiro"); }
      else if (e.key === "F5") { e.preventDefault(); setFormaPagamento("cartao_credito"); }
      else if (e.key === "F6") { e.preventDefault(); setFormaPagamento("cartao_debito"); }
      else if (e.key === "F8") { e.preventDefault(); descontoRef.current?.focus(); }
      else if (e.key === "F9") { 
        e.preventDefault(); 
        if (podeFinalizar && !mFinalizar.isPending) mFinalizar.mutate(); 
      }
      else if (e.key === "Escape") { e.preventDefault(); limparCarrinho(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [caixaAtual, podeFinalizar, mFinalizar.isPending, mFinalizar.mutate]);

  return (
    <div className="space-y-6">
      {modalFechamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass w-full max-w-md rounded-3xl p-6 shadow-2xl border border-border/60">
            <h2 className="text-xl font-display font-bold mb-3 flex items-center gap-2"><LogOut className="h-5 w-5 text-amber-500" /> Fechar Caixa</h2>
            <p className="text-sm text-muted-foreground mb-6">
              O caixa atual será fechado. As vendas do dia serão totalizadas e o comprovante de fechamento será impresso automaticamente. Deseja continuar?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModalFechamento(false)} className="px-4 py-2.5 text-sm font-medium rounded-xl border border-border/60 hover:bg-secondary/80 transition">Cancelar</button>
              <button onClick={() => mFechar.mutate()} disabled={mFechar.isPending} className="px-5 py-2.5 text-sm font-medium rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-50 flex items-center gap-2">
                {mFechar.isPending ? "Calculando..." : "Confirmar Fechamento"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <ShoppingCart className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">PDV</h1>
            <p className="text-sm text-muted-foreground mt-1">Frente de caixa com controle de sessão e impressão.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-secondary/50 border border-border/60 px-3 py-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Operador:</span>
            <span className="text-sm font-semibold truncate max-w-[120px]">{caixaAtual.operador_nome}</span>
          </div>
          <button onClick={() => setModalFechamento(true)} className="text-xs font-medium text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 transition px-4 py-2 rounded-xl border border-amber-500/40 hover:border-amber-500/60 flex items-center gap-1.5">
            <LogOut className="h-3.5 w-3.5" /> Fechar Caixa
          </button>
          
          <div className="w-px h-6 bg-border mx-1 hidden sm:block"></div>
          
          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-secondary/50 border border-border/60 px-3 py-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold tabular-nums">{totalItens} <span className="text-xs text-muted-foreground font-normal">itens no carrinho</span></span>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input ref={buscaRef} autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto por nome ou código (F2)" className="w-full rounded-xl border border-border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
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

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {catalogo.map((p, i) => (
              <motion.button key={p.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                onClick={() => addToCart(p)}
                disabled={Number(p.quantidade) <= 0}
                className="glass rounded-2xl p-4 text-left hover:border-primary/40 transition group disabled:opacity-50 disabled:cursor-not-allowed">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{p.categoria ?? "Diversos"}</div>
                    <div className="mt-1 font-medium leading-tight">{p.nome}</div>
                    <div className="text-xs mt-1 flex items-center gap-1.5">
                      <span className={`inline-flex h-1.5 w-1.5 rounded-full ${Number(p.quantidade) <= 0 ? "bg-destructive" : Number(p.quantidade) < 5 ? "bg-amber-500" : "bg-emerald-500"}`} />
                      <span className="text-muted-foreground">{Number(p.quantidade)} {p.unidade ?? ""} disp.</span>
                    </div>
                  </div>
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="mt-3 font-display text-lg font-semibold tabular-nums">{brl(Number(p.preco_venda))}</div>
              </motion.button>
            ))}
            {catalogo.length === 0 && (
              <div className="col-span-full glass rounded-2xl py-12 text-center text-sm text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                {busca || categoriaFiltro !== "todas" ? "Nenhum produto encontrado com esses filtros." : "Nenhum produto cadastrado."}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="space-y-4 lg:sticky lg:top-6 self-start max-h-[calc(100vh-2rem)] overflow-y-auto styled-scrollbar pr-2 pb-6">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Carrinho</h2>
              {cart.length > 0 && (
                <button onClick={limparCarrinho} className="text-xs text-destructive opacity-80 hover:opacity-100 hover:underline">
                  Limpar tudo
                </button>
              )}
            </div>
            {cart.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Adicione produtos para iniciar a venda
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 styled-scrollbar">
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
                      ref={descontoRef}
                      type="text"
                      inputMode="decimal"
                      value={descontoStr}
                      onChange={e => setDescontoStr(e.target.value)}
                      placeholder="0,00"
                      className="w-28 rounded-md border border-input bg-background pl-8 pr-2 py-1.5 text-sm text-right tabular-nums outline-none focus:ring-1 focus:ring-primary/30"
                      title="Atalho F8"
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
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/40">
              <option value="">Consumidor final (Balcão)</option>
              {(clientes as any[]).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-medium mb-3">Forma de pagamento</h3>
            <div className="grid grid-cols-2 gap-2">
              {pagamentos.map(fp => (
                <button key={fp.key} onClick={() => setFormaPagamento(fp.key)} type="button"
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition ${formaPagamento === fp.key ? "border-primary bg-primary/10 text-primary shadow-[0_0_16px_-6px_oklch(0.65_0.18_240/0.5)]" : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                  <fp.icon className="h-4 w-4" />
                  <span>{fp.label}</span>
                  {fp.hint && <span className="text-[10px] opacity-70 font-normal text-center leading-tight hidden sm:block">{fp.hint}</span>}
                </button>
              ))}
            </div>

            {formaPagamento === "dinheiro" && cart.length > 0 && (
              <div className="mt-4 space-y-2 pt-3 border-t border-border/40">
                <label className="text-xs text-muted-foreground font-medium">Valor recebido (R$)</label>
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
                      <span className="text-muted-foreground">Troco ao cliente</span>
                      <span className="font-semibold tabular-nums text-emerald-500 text-sm">{brl(troco)}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {cart.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/40">
                <label className="text-xs text-muted-foreground font-medium">Observação (opcional)</label>
                <input
                  type="text"
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  maxLength={500}
                  placeholder="Ex.: entregar amanhã..."
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            )}
          </div>

          <button onClick={() => mFinalizar.mutate()} disabled={!podeFinalizar} className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_24px_-4px_oklch(0.65_0.18_240/0.5)] flex items-center justify-center gap-2">
            <Receipt className="h-4 w-4" />
            {mFinalizar.isPending ? "Processando…" : cart.length === 0 ? "Adicione produtos" : `Finalizar Venda (F9) — ${brl(total)}`}
          </button>
          
          <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-border/40 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            <span className="flex items-center gap-1"><Keyboard className="h-3 w-3" /> F2: Buscar</span>
            <span>F3: PIX</span>
            <span>F4: Dinheiro</span>
            <span>F5: Crédito</span>
            <span>F6: Débito</span>
            <span>F8: Desconto</span>
            <span>F9: Finalizar</span>
            <span>ESC: Limpar</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
