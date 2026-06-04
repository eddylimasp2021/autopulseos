import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShoppingCart, Search, Plus, Minus, Trash2, QrCode, CreditCard, Banknote, Receipt, Package, User, Percent, Wallet, LogOut, Keyboard, Loader2, History, ArrowDownToLine, ArrowUpFromLine, Undo } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listEstoqueParaPDV, finalizarVenda, verificarCaixaAberto, abrirCaixa, fecharCaixa, getResumoCaixa, registrarSangria, registrarReforco, listVendasCaixa, estornarVenda, listarVendasPdv } from "@/lib/pdv.functions";
import { listClientes } from "@/lib/clientes.functions";
import { listOrdens, getOrdem, updateOrdemStatus } from "@/lib/ordens.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { imprimirCupomNaoFiscal, imprimirAberturaCaixa, imprimirFechamentoCaixa } from "@/lib/print";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContadorMoedas } from "@/components/app/ContadorMoedas";
import { getTefConfig } from "@/lib/tef.functions";
import { TefDialog } from "@/components/app/TefDialog";

export const Route = createFileRoute("/_authenticated/app/pdv")({ component: Page });

interface CartItem { id: string; nome: string; preco: number; qtd: number; estoque: number; }
type Produto = { id: string; nome: string; categoria: string | null; preco_venda: number; quantidade: number; unidade: string | null; codigo: string | null };

type FormaPagamento = "pix" | "dinheiro" | "cartao_credito" | "cartao_debito";
const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

const QtdControl = ({ item, updateQtd, setQtd }: { item: CartItem, updateQtd: (id: string, delta: number) => void, setQtd: (id: string, value: number) => void }) => {
  const [val, setVal] = useState(item.qtd.toString());

  useEffect(() => {
    setVal(item.qtd.toString());
  }, [item.qtd]);

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => updateQtd(item.id, -1)} className="grid h-7 w-7 place-items-center rounded-md bg-secondary hover:bg-primary/20 transition"><Minus className="h-3 w-3" /></button>
      <Input 
        type="text" 
        inputMode="decimal"
        className="w-16 h-7 text-center text-sm font-medium tabular-nums p-0 bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-primary/50" 
        value={val}
        onChange={(e) => {
          let str = e.target.value.replace(/[^0-9.,]/g, '');
          setVal(str);
          let parsed = parseFloat(str.replace(',', '.'));
          if (!isNaN(parsed)) {
            setQtd(item.id, parsed);
          }
        }} 
        onBlur={() => { 
          let parsed = parseFloat(val.replace(',', '.'));
          if (isNaN(parsed) || parsed === 0) {
            setVal("1");
            setQtd(item.id, 1);
          } else {
            setVal(parsed.toString());
            setQtd(item.id, parsed);
          }
        }}
        onFocus={(e) => e.target.select()}
        onClick={(e) => (e.target as HTMLInputElement).select()}
      />
      <button onClick={() => updateQtd(item.id, 1)} className="grid h-7 w-7 place-items-center rounded-md bg-secondary hover:bg-primary/20 transition"><Plus className="h-3 w-3" /></button>
    </div>
  );
};

function Page() {
  const [busca, setBusca] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [clienteId, setClienteId] = useState<string>("");
  const [descontoStr, setDescontoStr] = useState("");
  const [recebidoStr, setRecebidoStr] = useState("");
  const [observacao, setObservacao] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [isPagamentoMultiplo, setIsPagamentoMultiplo] = useState(false);
  const [pagamentosAdicionados, setPagamentosAdicionados] = useState<{ id: string, forma: FormaPagamento, valor: number }[]>([]);
  const [formaPagamentoMultiplo, setFormaPagamentoMultiplo] = useState<FormaPagamento>("pix");
  const [valorMultiploStr, setValorMultiploStr] = useState("");
  const qc = useQueryClient();
  const buscaRef = useRef<HTMLInputElement>(null);
  const descontoRef = useRef<HTMLInputElement>(null);

  // Estados locais para OS
  const [modalOSOpen, setModalOSOpen] = useState(false);
  const [osBusca, setOsBusca] = useState("");
  const [importedOsId, setImportedOsId] = useState<string | null>(null);
  const [importedOsNumero, setImportedOsNumero] = useState<number | null>(null);

  const listEst = useServerFn(listEstoqueParaPDV);
  const finalizar = useServerFn(finalizarVenda);
  const listCli = useServerFn(listClientes);
  
  // Funções de OS
  const listOsFn = useServerFn(listOrdens);
  const getOsFn = useServerFn(getOrdem);
  const updateOsStatusFn = useServerFn(updateOrdemStatus);

  // Funções de Caixa e Movimentações
  const vCaixa = useServerFn(verificarCaixaAberto);
  const mAbrirCaixa = useServerFn(abrirCaixa);
  const mFecharCaixa = useServerFn(fecharCaixa);
  const getResumoFn = useServerFn(getResumoCaixa);
  const mSangria = useServerFn(registrarSangria);
  const mReforco = useServerFn(registrarReforco);
  const mListVendas = useServerFn(listVendasCaixa);
  const mListRecibos = useServerFn(listarVendasPdv);
  const mEstornar = useServerFn(estornarVenda);
  const fnGetTef = useServerFn(getTefConfig);

  const { data: produtos = [] } = useQuery({ queryKey: ["pdv-estoque"], queryFn: () => listEst() });
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => listCli() });
  const { data: ordens = [] } = useQuery({ queryKey: ["pdv-ordens"], queryFn: () => listOsFn() });
  const { data: caixaAtual, isLoading: loadingCaixa } = useQuery({ queryKey: ["pdv-caixa"], queryFn: () => vCaixa() });

  const [saldoAbertura, setSaldoAbertura] = useState("");
  const [modalFechamento, setModalFechamento] = useState(false);
  const [saldoFechamentoInformado, setSaldoFechamentoInformado] = useState("");

  const { data: resumoCaixa, isLoading: loadingResumo } = useQuery({
    queryKey: ["pdv-caixa-resumo", caixaAtual?.id],
    queryFn: () => getResumoFn({ data: { caixa_id: caixaAtual?.id! } }),
    enabled: !!caixaAtual?.id && modalFechamento
  });

  const { data: tefConfig } = useQuery({
    queryKey: ["pdv-tef-config"],
    queryFn: () => fnGetTef(),
  });

  const [tefDialogOpen, setTefDialogOpen] = useState(false);
  const [tefValor, setTefValor] = useState(0);
  const [tefTipo, setTefTipo] = useState("");
  const [tefPagamentoAdicionado, setTefPagamentoAdicionado] = useState<{ id: string, forma: FormaPagamento, valor: number } | null>(null);

  // States para Sangria, Reforço, Devolução e Histórico
  const [modalSangriaOpen, setModalSangriaOpen] = useState(false);
  const [modalReforcoOpen, setModalReforcoOpen] = useState(false);
  const [modalHistoricoOpen, setModalHistoricoOpen] = useState(false);
  const [modalRecibosOpen, setModalRecibosOpen] = useState(false);
  const [sangriaValor, setSangriaValor] = useState("");
  const [sangriaObs, setSangriaObs] = useState("");
  
  const [filtroMesRecibos, setFiltroMesRecibos] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 7);
  });
  const [reforcoValor, setReforcoValor] = useState("");
  const [reforcoObs, setReforcoObs] = useState("");
  const [modoDevolucao, setModoDevolucao] = useState(false);

  const { data: vendasHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["pdv-historico-vendas", caixaAtual?.id],
    queryFn: () => mListVendas({ data: caixaAtual?.id! }),
    enabled: !!caixaAtual?.id && modalHistoricoOpen
  });

  const { data: recibosHistory = [], isLoading: loadingRecibos } = useQuery({
    queryKey: ["pdv-historico-recibos", filtroMesRecibos],
    queryFn: () => mListRecibos(filtroMesRecibos),
    enabled: modalRecibosOpen
  });

  useEffect(() => {
    if (!modalFechamento) {
      setSaldoFechamentoInformado("");
    }
  }, [modalFechamento]);

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
  
  const totalPagoMultiplo = pagamentosAdicionados.reduce((s, p) => s + p.valor, 0);
  const faltaPagarMultiplo = Math.max(0, total - totalPagoMultiplo);

  const recebido = Number(recebidoStr.replace(",", ".")) || 0;
  const troco = !isPagamentoMultiplo && formaPagamento === "dinheiro" ? Math.max(0, recebido - total) : 0;
  const faltaReceber = !isPagamentoMultiplo && formaPagamento === "dinheiro" ? Math.max(0, total - recebido) : 0;

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
    mutationFn: () => mFecharCaixa({ 
      data: { 
        caixa_id: caixaAtual?.id!, 
        saldo_dinheiro_informado: Number(saldoFechamentoInformado.replace(",", ".")) || 0 
      } 
    }),
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

  const mFazSangria = useMutation({
    mutationFn: () => mSangria({ data: { caixa_id: caixaAtual?.id!, valor: Number(sangriaValor.replace(",", ".")), observacao: sangriaObs } }),
    onSuccess: () => {
      toast.success("Sangria registrada com sucesso!");
      setModalSangriaOpen(false); setSangriaValor(""); setSangriaObs("");
      qc.invalidateQueries({ queryKey: ["pdv-caixa-resumo"] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const mFazReforco = useMutation({
    mutationFn: () => mReforco({ data: { caixa_id: caixaAtual?.id!, valor: Number(reforcoValor.replace(",", ".")), observacao: reforcoObs } }),
    onSuccess: () => {
      toast.success("Reforço registrado com sucesso!");
      setModalReforcoOpen(false); setReforcoValor(""); setReforcoObs("");
      qc.invalidateQueries({ queryKey: ["pdv-caixa-resumo"] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const mFazEstorno = useMutation({
    mutationFn: (lanc_id: string) => mEstornar({ data: lanc_id }),
    onSuccess: () => {
      toast.success("Venda estornada com sucesso!");
      qc.invalidateQueries({ queryKey: ["pdv-historico-vendas"] });
      qc.invalidateQueries({ queryKey: ["pdv-caixa-resumo"] });
      qc.invalidateQueries({ queryKey: ["pdv-estoque"] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const addToCart = (p: Produto) => {
    if (!modoDevolucao && Number(p.quantidade) <= 0) {
      toast.error(`${p.nome} sem estoque disponível`);
      return;
    }
    setCart(prev => {
      const qtyToAdd = modoDevolucao ? -1 : 1;
      const ex = prev.find(x => x.id === p.id);
      if (ex) {
        if (!modoDevolucao && ex.qtd + 1 > ex.estoque) {
          toast.error(`Estoque máximo de ${ex.estoque} para ${ex.nome}`);
          return prev;
        }
        return prev.map(x => x.id === p.id ? { ...x, qtd: x.qtd + qtyToAdd } : x);
      }
      return [...prev, { id: p.id, nome: p.nome, preco: Number(p.preco_venda), qtd: qtyToAdd, estoque: Number(p.quantidade) }];
    });
  };
  const updateQtd = (id: string, delta: number) =>
    setCart(prev => prev.map(x => {
      if (x.id !== id) return x;
      const next = x.qtd + delta;
      if (!modoDevolucao && next > x.estoque) {
        toast.warning("Estoque insuficiente", { description: `Restam apenas ${x.estoque} unidades.` });
        return x;
      }
      if (next === 0) return { ...x, qtd: delta > 0 ? 1 : -1 }; // Skip 0
      return { ...x, qtd: next };
    }));

  const setQtd = (id: string, value: number) => {
    if (isNaN(value)) return;
    setCart(prev => prev.map(x => {
      if (x.id !== id) return x;
      if (value === 0) return x; // Skip 0
      if (!modoDevolucao && value > x.estoque) {
        toast.warning("Estoque insuficiente", { description: `Restam apenas ${x.estoque} unidades.` });
        return { ...x, qtd: x.estoque };
      }
      return { ...x, qtd: value };
    }));
  };
  const removeItem = (id: string) => setCart(prev => prev.filter(x => x.id !== id));
  const limparCarrinho = () => { 
    setCart([]); setDescontoStr(""); setRecebidoStr(""); setObservacao(""); 
    setIsPagamentoMultiplo(false); setPagamentosAdicionados([]); 
    setImportedOsId(null); setImportedOsNumero(null);
  };

  const handleImportOS = async (os: any) => {
    try {
      const osCompleta = await getOsFn({ data: { id: os.id } });
      if (!osCompleta) {
        toast.error("Erro ao buscar itens da OS.");
        return;
      }
      
      const cartItems: CartItem[] = osCompleta.itens.map((it: any) => {
        return {
          id: it.estoque_item_id || it.id || crypto.randomUUID(),
          nome: it.descricao,
          preco: Number(it.valor_unit),
          qtd: Number(it.quantidade),
          estoque: it.estoque_item_id 
            ? (produtos.find((p: any) => p.id === it.estoque_item_id)?.quantidade ?? Number(it.quantidade))
            : 99999
        };
      });

      setCart(cartItems);
      setClienteId(osCompleta.cliente_id || "");
      setDescontoStr(osCompleta.desconto ? String(osCompleta.desconto) : "");
      setObservacao(`Cobrança da OS #${osCompleta.numero}`);
      setImportedOsId(osCompleta.id);
      setImportedOsNumero(osCompleta.numero);
      
      setModalOSOpen(false);
      toast.success(`OS #${osCompleta.numero} importada com sucesso!`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar OS.");
    }
  };

  const mUpdateOsStatus = useMutation({
    mutationFn: (v: { id: string; status: any }) => updateOsStatusFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdv-ordens"] });
      qc.invalidateQueries({ queryKey: ["ordens"] });
    },
    onError: (e: Error) => console.error("Erro ao atualizar status da OS:", e.message)
  });

  const onBuscaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!busca.trim()) return;
      
      // Procura primeiro pelo código de barras exato
      const exato = (produtos as Produto[]).find(p => p.codigo?.toLowerCase() === busca.toLowerCase().trim());
      // Se não achar código exato, vê se o filtro deixou apenas 1 produto na tela
      const p = exato || (catalogo.length === 1 ? catalogo[0] : null);
      
      if (p) {
        addToCart(p);
        setBusca("");
      } else {
        toast.error("Produto não encontrado ou busca ambígua.");
      }
    }
  };

  const mFinalizar = useMutation({
    mutationFn: () => finalizar({
      data: {
        cliente_id: clienteId || null,
        caixa_id: caixaAtual?.id!,
        pagamentos: isPagamentoMultiplo 
          ? pagamentosAdicionados.map(p => ({ forma: p.forma, valor: p.valor }))
          : [{ forma: formaPagamento, valor: total }],
        desconto: desconto > 0 ? desconto : null,
        valor_recebido: (!isPagamentoMultiplo && formaPagamento === "dinheiro" && !modoDevolucao) ? recebido : null,
        observacao: observacao || null,
        itens: cart.map(c => {
          const isRealStockItem = (produtos as Produto[]).some(p => p.id === c.id);
          return {
            estoque_item_id: isRealStockItem ? c.id : null,
            descricao: c.nome,
            quantidade: c.qtd,
            valor_unit: c.preco
          };
        }),
      },
    }),
    onSuccess: (r: any) => {
      const trocoMsg = r.troco > 0 ? ` — Troco ${brl(Number(r.troco))}` : "";
      toast.success(`Venda finalizada — ${brl(Number(r.total))}${trocoMsg}`);
      
      imprimirCupomNaoFiscal({
        itens: cart,
        subtotal: subtotal,
        desconto: desconto,
        total: r.total,
        pagamentos: isPagamentoMultiplo 
          ? pagamentosAdicionados.map(p => ({ forma: p.forma, valor: p.valor }))
          : [{ forma: formaPagamento, valor: total }],
        recebido: !isPagamentoMultiplo && formaPagamento === "dinheiro" ? recebido : undefined,
        troco: r.troco,
        observacao: observacao,
        data: new Date().toLocaleString("pt-BR"),
        operador: caixaAtual?.operador_nome
      });

      if (importedOsId) {
        mUpdateOsStatus.mutate({ id: importedOsId, status: "entregue" });
      }

      limparCarrinho(); setClienteId("");
      qc.invalidateQueries({ queryKey: ["pdv-estoque"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const podeFinalizar = cart.length > 0 && !mFinalizar.isPending && total > 0 && 
    (isPagamentoMultiplo 
      ? faltaPagarMultiplo <= 0 
      : (formaPagamento !== "dinheiro" || recebido >= total));

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
              <ContadorMoedas onConfirm={(val) => setSaldoAbertura(val.toFixed(2).replace('.', ','))} />
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

  return (
    <div className="space-y-6">
      {modalFechamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass w-full max-w-md rounded-3xl p-6 shadow-2xl border border-border/60">
            <h2 className="text-xl font-display font-bold mb-3 flex items-center gap-2"><LogOut className="h-5 w-5 text-amber-500" /> Fechar Caixa</h2>
            <p className="text-xs text-muted-foreground mb-4">
              O caixa atual será fechado. As vendas do dia serão totalizadas e o comprovante de fechamento será impresso automaticamente.
            </p>

            {loadingResumo ? (
              <div className="flex flex-col items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Calculando valores do caixa...</span>
              </div>
            ) : resumoCaixa ? (
              <div className="bg-secondary/35 rounded-2xl p-4 border border-border/40 mb-6 space-y-2.5 text-sm">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Resumo do Período (Antes de Fechar)</div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Saldo de Abertura:</span>
                  <span className="font-semibold tabular-nums">{resumoCaixa.saldo_abertura.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="h-px bg-border/40 my-1"></div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5 text-amber-500" /> Dinheiro:</span>
                  <span className="font-bold tabular-nums">{resumoCaixa.dinheiro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs flex items-center gap-1.5"><QrCode className="h-3.5 w-3.5 text-sky-400" /> PIX:</span>
                  <span className="font-bold tabular-nums">{resumoCaixa.pix.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-indigo-400" /> Cartão Crédito:</span>
                  <span className="font-bold tabular-nums">{resumoCaixa.credito.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-teal-400" /> Cartão Débito:</span>
                  <span className="font-bold tabular-nums">{resumoCaixa.debito.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="h-px bg-border/40 my-1"></div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-xs">Total de Vendas:</span>
                  <span className="font-bold text-primary tabular-nums">{resumoCaixa.total_vendas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="flex justify-between items-center bg-secondary/60 p-2 rounded-xl border border-border/20 mt-2">
                  <span className="font-bold text-xs">Saldo em Caixa (Dinheiro + Abertura):</span>
                  <span className="font-extrabold text-foreground tabular-nums">{(resumoCaixa.dinheiro + resumoCaixa.saldo_abertura).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
              </div>
            ) : null}

            {resumoCaixa && (
              <div className="mb-6 space-y-2">
                <Label htmlFor="saldo_fechamento_informado" className="text-xs font-semibold text-foreground">
                  Confirmar Valor Físico em Dinheiro no Caixa (Gaveta) *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">R$</span>
                  <Input
                    id="saldo_fechamento_informado"
                    value={saldoFechamentoInformado}
                    onChange={(e) => setSaldoFechamentoInformado(e.target.value)}
                    placeholder="0,00"
                    required
                    className="pl-8 bg-secondary/35 text-sm font-semibold"
                  />
                </div>
                <ContadorMoedas onConfirm={(val) => setSaldoFechamentoInformado(val.toFixed(2).replace('.', ','))} />
                {saldoFechamentoInformado && (
                  <div className="text-[11px] font-semibold mt-1">
                    {(() => {
                      const informado = Number(saldoFechamentoInformado.replace(",", ".")) || 0;
                      const esperado = resumoCaixa.dinheiro + resumoCaixa.saldo_abertura;
                      const diferenca = informado - esperado;
                      if (diferenca === 0) {
                        return <span className="text-emerald-400">Caixa perfeito (sem diferença)</span>;
                      } else if (diferenca > 0) {
                        return <span className="text-sky-400">Sobra de caixa: + {diferenca.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>;
                      } else {
                        return <span className="text-red-400">Diferença de caixa (quebra): - {Math.abs(diferenca).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>;
                      }
                    })()}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Digite a quantidade exata de cédulas e moedas (em espécie) contadas na gaveta do caixa.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => setModalFechamento(false)} className="px-4 py-2.5 text-sm font-medium rounded-xl border border-border/60 hover:bg-secondary/80 transition">Cancelar</button>
              <button onClick={() => mFechar.mutate()} disabled={mFechar.isPending || loadingResumo || !saldoFechamentoInformado} className="px-5 py-2.5 text-sm font-medium rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-50 flex items-center gap-2">
                {mFechar.isPending ? "Calculando..." : "Confirmar Fechamento"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL SANGRIA */}
      <Dialog open={modalSangriaOpen} onOpenChange={setModalSangriaOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowDownToLine className="h-5 w-5 text-red-500" /> Sangria de Caixa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valor da Retirada (R$)</Label>
              <Input type="number" step="0.01" min="0" value={sangriaValor} onChange={e => setSangriaValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Motivo / Observação</Label>
              <Input value={sangriaObs} onChange={e => setSangriaObs(e.target.value)} placeholder="Ex: Pagamento de fornecedor" />
            </div>
            <Button onClick={() => mFazSangria.mutate()} disabled={mFazSangria.isPending || !sangriaValor || !sangriaObs} className="w-full" variant="destructive">
              {mFazSangria.isPending ? "Registrando..." : "Registrar Sangria"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL REFORÇO */}
      <Dialog open={modalReforcoOpen} onOpenChange={setModalReforcoOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowUpFromLine className="h-5 w-5 text-emerald-500" /> Reforço de Caixa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valor da Entrada (R$)</Label>
              <Input type="number" step="0.01" min="0" value={reforcoValor} onChange={e => setReforcoValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Motivo / Observação</Label>
              <Input value={reforcoObs} onChange={e => setReforcoObs(e.target.value)} placeholder="Ex: Troco inicial" />
            </div>
            <Button onClick={() => mFazReforco.mutate()} disabled={mFazReforco.isPending || !reforcoValor || !reforcoObs} className="w-full bg-emerald-500 hover:bg-emerald-600">
              {mFazReforco.isPending ? "Registrando..." : "Registrar Reforço"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modalRecibosOpen} onOpenChange={setModalRecibosOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Receipt className="h-5 w-5" /> Cupons Emitidos (2ª Via)
              </span>
              <div className="flex items-center gap-2 font-normal text-sm pr-6">
                <span className="text-muted-foreground text-xs">Mês:</span>
                <Input 
                  type="month" 
                  value={filtroMesRecibos} 
                  onChange={e => setFiltroMesRecibos(e.target.value)}
                  className="w-36 h-8 text-xs"
                />
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-2">
            {loadingRecibos ? (
              <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : recibosHistory.length === 0 ? (
              <p className="text-center text-muted-foreground p-4">Nenhuma venda encontrada.</p>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 border-b border-border/50 sticky top-0">
                  <tr className="text-xs uppercase text-muted-foreground">
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Operador</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recibosHistory.map((v: any) => (
                    <tr key={v.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="p-3">{new Date(v.created_at).toLocaleString('pt-BR')}</td>
                      <td className="p-3">{v.clientes?.nome || 'Avulso'}</td>
                      <td className="p-3 tabular-nums font-medium">{Number(v.total).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                      <td className="p-3">{v.operador_nome}</td>
                      <td className="p-3 text-right">
                        <Button 
                          variant="outline" size="sm" className="h-8 gap-2"
                          onClick={() => {
                            imprimirCupomNaoFiscal({
                              itens: v.itens,
                              total: Number(v.total),
                              subtotal: Number(v.subtotal),
                              desconto: Number(v.desconto),
                              valorRecebido: Number(v.total) + Number(v.troco),
                              troco: Number(v.troco),
                              pagamentos: v.pagamentos,
                              clienteNome: v.clientes?.nome,
                              clienteCpfCnpj: v.clientes?.cpf_cnpj,
                              observacao: v.observacao || undefined
                            });
                          }}
                        >
                          <Receipt className="h-3.5 w-3.5" /> Reimprimir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL HISTÓRICO */}
      <Dialog open={modalHistoricoOpen} onOpenChange={setModalHistoricoOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Histórico de Vendas do Caixa</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : vendasHistory.length === 0 ? (
              <p className="text-center text-muted-foreground p-4">Nenhuma venda registrada neste caixa ainda.</p>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 border-b border-border/50 sticky top-0">
                  <tr className="text-xs uppercase text-muted-foreground">
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Forma</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {vendasHistory.map((l: any) => {
                    const isEstornada = l.descricao.includes("[ESTORNADA]");
                    return (
                      <tr key={l.id} className={`hover:bg-secondary/30 ${isEstornada ? 'opacity-50' : ''}`}>
                        <td className="p-3">{new Date(l.created_at).toLocaleTimeString('pt-BR')}</td>
                        <td className="p-3 max-w-[200px] truncate" title={l.descricao}>{l.descricao}</td>
                        <td className="p-3 tabular-nums">{Number(l.valor).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                        <td className="p-3 capitalize">{l.forma_pagamento.replace('_', ' ')}</td>
                        <td className="p-3 text-right">
                          <Button 
                            variant="destructive" size="sm" className="h-8" 
                            disabled={isEstornada || mFazEstorno.isPending} 
                            onClick={() => {
                              if (confirm("Tem certeza que deseja estornar esta venda? Os itens retornarão ao estoque e o valor sairá do caixa.")) {
                                mFazEstorno.mutate(l.id);
                              }
                            }}
                          >
                            <Undo className="h-3 w-3 mr-1" /> Estornar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ImportarOSDialog 
        open={modalOSOpen} 
        onOpenChange={setModalOSOpen} 
        ordens={ordens as any[]} 
        onImport={handleImportOS} 
      />

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
          
          <button 
            onClick={() => setModalOSOpen(true)} 
            className="text-xs font-medium text-primary hover:bg-primary/10 transition px-4 py-2 rounded-xl border border-primary/40 hover:border-primary/60 flex items-center gap-1.5"
          >
            <Receipt className="h-3.5 w-3.5" /> Importar OS
          </button>

          <div className="w-px h-6 bg-border mx-1 hidden sm:block"></div>

          <button 
            onClick={() => setModalSangriaOpen(true)} 
            className="text-xs font-medium text-red-500 hover:bg-red-500/10 transition px-3 py-2 rounded-xl border border-red-500/40 hover:border-red-500/60 flex items-center gap-1.5"
            title="Retirar dinheiro do caixa"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" /> Sangria
          </button>
          
          <button 
            onClick={() => setModalReforcoOpen(true)} 
            className="text-xs font-medium text-emerald-500 hover:bg-emerald-500/10 transition px-3 py-2 rounded-xl border border-emerald-500/40 hover:border-emerald-500/60 flex items-center gap-1.5"
            title="Adicionar troco no caixa"
          >
            <ArrowUpFromLine className="h-3.5 w-3.5" /> Reforço
          </button>

          <button 
            onClick={() => setModalHistoricoOpen(true)} 
            className="text-xs font-medium text-blue-500 hover:bg-blue-500/10 transition px-3 py-2 rounded-xl border border-blue-500/40 hover:border-blue-500/60 flex items-center gap-1.5"
            title="Histórico e Estorno do Caixa"
          >
            <History className="h-3.5 w-3.5" /> Histórico Caixa
          </button>
          
          <button 
            onClick={() => setModalRecibosOpen(true)} 
            className="text-xs font-medium text-purple-500 hover:bg-purple-500/10 transition px-3 py-2 rounded-xl border border-purple-500/40 hover:border-purple-500/60 flex items-center gap-1.5"
            title="Ver e reimprimir todos os cupons de venda"
          >
            <Receipt className="h-3.5 w-3.5" /> 2ª Via
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
            <input 
              ref={buscaRef} 
              autoFocus 
              value={busca} 
              onChange={e => setBusca(e.target.value)} 
              onKeyDown={onBuscaKeyDown}
              placeholder="Buscar produto ou bipar código (F2)" 
              className={`w-full rounded-xl border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 ${modoDevolucao ? 'border-orange-500 focus:ring-orange-500/30' : 'border-border focus:ring-primary/30'}`} 
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setModoDevolucao(!modoDevolucao)}
              className={`text-xs font-medium transition px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${modoDevolucao ? 'bg-orange-500 text-white border-orange-600' : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary'}`}
            >
              <Undo className="h-3.5 w-3.5" />
              {modoDevolucao ? "Modo Devolução Ativo (Valores Negativos)" : "Ativar Modo Devolução"}
            </button>
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
              <div>
                <h2 className="font-display text-lg font-semibold">Carrinho</h2>
                {importedOsNumero && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full mt-1">
                    OS #{importedOsNumero} vinculada
                  </span>
                )}
              </div>
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
                    <QtdControl item={item} updateQtd={updateQtd} setQtd={setQtd} />
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Forma de pagamento</h3>
              {cart.length > 0 && total > 0 && (
                <button 
                  onClick={() => setIsPagamentoMultiplo(!isPagamentoMultiplo)}
                  className="text-[10px] uppercase font-bold tracking-wider text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-md transition"
                >
                  {isPagamentoMultiplo ? "Usar Único" : "Dividir Pagamento"}
                </button>
              )}
            </div>

            {!isPagamentoMultiplo ? (
              <>
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
                    <div className="pt-1">
                      <ContadorMoedas onConfirm={(val) => setRecebidoStr(val.toFixed(2).replace('.', ','))} />
                    </div>
                    <div className="flex justify-between text-xs pt-1 mt-1">
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
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <select 
                      value={formaPagamentoMultiplo} 
                      onChange={e => setFormaPagamentoMultiplo(e.target.value as FormaPagamento)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30"
                    >
                      <option value="pix">PIX</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                    </select>
                  </div>
                  <div className="flex-1 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valorMultiploStr}
                      onChange={e => setValorMultiploStr(e.target.value)}
                      placeholder={faltaPagarMultiplo > 0 ? faltaPagarMultiplo.toFixed(2) : "0,00"}
                      className="w-full rounded-md border border-input bg-background pl-8 pr-2 py-2 text-sm text-right tabular-nums outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      const val = Number(valorMultiploStr.replace(",", ".")) || faltaPagarMultiplo;
                      if (val <= 0) return;
                      
                      if (tefConfig?.ativo && ["pix", "cartao_credito", "cartao_debito"].includes(formaPagamentoMultiplo)) {
                        setTefValor(val);
                        setTefTipo(formaPagamentoMultiplo);
                        setTefPagamentoAdicionado({ id: crypto.randomUUID(), forma: formaPagamentoMultiplo, valor: val });
                        setTefDialogOpen(true);
                      } else {
                        setPagamentosAdicionados([...pagamentosAdicionados, { id: crypto.randomUUID(), forma: formaPagamentoMultiplo, valor: val }]);
                        setValorMultiploStr("");
                      }
                    }}
                    disabled={faltaPagarMultiplo <= 0}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {pagamentosAdicionados.length > 0 && (
                  <div className="space-y-2 border-t border-border/40 pt-3">
                    {pagamentosAdicionados.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-sm bg-secondary/40 px-3 py-2 rounded-lg">
                        <span className="capitalize">{p.forma.replace("cartao_", "cartão ")}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-medium tabular-nums">{brl(p.valor)}</span>
                          <button onClick={() => setPagamentosAdicionados(prev => prev.filter(x => x.id !== p.id))} className="text-destructive hover:text-destructive/80"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center text-xs pt-1">
                      {faltaPagarMultiplo > 0 ? (
                        <>
                          <span className="text-amber-500 font-medium">Falta Pagar</span>
                          <span className="font-semibold tabular-nums text-amber-500 text-sm">{brl(faltaPagarMultiplo)}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-emerald-500 font-medium">Pago</span>
                          <span className="font-semibold tabular-nums text-emerald-500 text-sm">{brl(totalPagoMultiplo)}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
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

          <button 
            onClick={() => {
              if (!isPagamentoMultiplo && tefConfig?.ativo && ["pix", "cartao_credito", "cartao_debito"].includes(formaPagamento)) {
                setTefValor(total);
                setTefTipo(formaPagamento);
                setTefPagamentoAdicionado(null);
                setTefDialogOpen(true);
              } else {
                mFinalizar.mutate();
              }
            }} 
            disabled={!podeFinalizar} 
            className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_24px_-4px_oklch(0.65_0.18_240/0.5)] flex items-center justify-center gap-2"
          >
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

      {tefConfig && tefDialogOpen && (
        <TefDialog
          open={tefDialogOpen}
          onOpenChange={setTefDialogOpen}
          config={tefConfig}
          valor={tefValor}
          tipoPagamento={tefTipo}
          onSuccess={(nsu, receipts) => {
            if (tefPagamentoAdicionado) {
              setPagamentosAdicionados([...pagamentosAdicionados, tefPagamentoAdicionado]);
              setValorMultiploStr("");
            } else {
              mFinalizar.mutate();
            }
          }}
          onCancel={() => {
            setTefPagamentoAdicionado(null);
          }}
        />
      )}
    </div>
  );
}

function ImportarOSDialog({ open, onOpenChange, ordens, onImport }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  ordens: any[]; onImport: (os: any) => void;
}) {
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    return ordens.filter(o => {
      if (o.status === "cancelada" || o.status === "entregue") return false;
      const q = busca.toLowerCase().trim();
      if (!q) return true;
      return String(o.numero).includes(q) ||
        (o.clientes?.nome ?? "").toLowerCase().includes(q) ||
        (o.veiculos?.placa ?? "").toLowerCase().includes(q) ||
        (o.veiculos?.modelo ?? "").toLowerCase().includes(q);
    });
  }, [ordens, busca]);

  const statusLabel: Record<string, string> = {
    aberta: "Aberta", em_andamento: "Em andamento",
    aguardando_peca: "Aguardando peça", concluida: "Concluída"
  };

  const statusBg: Record<string, string> = {
    aberta: "bg-primary/10 text-primary border-primary/20",
    em_andamento: "bg-primary/10 text-primary border-primary/20",
    aguardando_peca: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    concluida: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>Importar Ordem de Serviço</DialogTitle></DialogHeader>

        <div className="relative mb-3 mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por número, cliente ou placa..." className="w-full rounded-xl border border-border bg-secondary/50 pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        <div className="flex-1 overflow-y-auto min-h-[300px] border border-border/50 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 border-b border-border/50 sticky top-0">
              <tr className="text-xs uppercase text-muted-foreground">
                <th className="p-3 font-medium">OS</th>
                <th className="p-3 font-medium">Cliente / Veículo</th>
                <th className="p-3 font-medium">Valor Total</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtradas.map(o => (
                <tr key={o.id} className="hover:bg-secondary/30 transition">
                  <td className="p-3 font-mono text-xs font-semibold text-primary">#{o.numero}</td>
                  <td className="p-3">
                    <div className="font-medium text-xs sm:text-sm">{o.clientes?.nome ?? "—"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {[o.veiculos?.marca, o.veiculos?.modelo].filter(Boolean).join(" ")} {o.veiculos?.placa ? `· ${o.veiculos.placa}` : ""}
                    </div>
                  </td>
                  <td className="p-3 font-medium tabular-nums">
                    {Number(o.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full border ${statusBg[o.status] || "bg-muted text-muted-foreground"}`}>
                      {statusLabel[o.status] || o.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" className="h-8" onClick={() => onImport(o)}>Importar</Button>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">Nenhuma ordem de serviço ativa encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
