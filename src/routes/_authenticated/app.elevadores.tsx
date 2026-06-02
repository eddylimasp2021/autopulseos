import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, Plus, Minus, Trash2, User, Car, Check, Play, ShoppingCart, Loader2, ArrowRightLeft, DollarSign, Clock } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { listOrdens, getOrdem, createOrdem, updateOrdemStatus, updateOrdemElevador, addOSItem, removeOSItem } from "@/lib/ordens.functions";
import { listClientes } from "@/lib/clientes.functions";
import { listVeiculos } from "@/lib/veiculos.functions";
import { listEstoque } from "@/lib/estoque.functions";
import { getWorkshop, updateWorkshopElevadores } from "@/lib/configuracoes.functions";

export const Route = createFileRoute("/_authenticated/app/elevadores")({ component: Page });

const OSDialogSchema = z.object({
  cliente_id: z.string().uuid("Selecione o cliente"),
  veiculo_id: z.string().uuid("Selecione o veículo"),
  descricao: z.string().trim().max(1000).optional(),
});
type OSDialogData = z.infer<typeof OSDialogSchema>;

function Page() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedBay, setSelectedBay] = useState<number | null>(null);
  const [osDialogOpen, setOsDialogOpen] = useState(false);

  // Server functions
  const listOs = useServerFn(listOrdens);
  const listCli = useServerFn(listClientes);
  const listVei = useServerFn(listVeiculos);
  const listEst = useServerFn(listEstoque);
  
  const createOs = useServerFn(createOrdem);
  const updateElevador = useServerFn(updateOrdemElevador);
  const updateStatus = useServerFn(updateOrdemStatus);
  const addItem = useServerFn(addOSItem);
  const removeItem = useServerFn(removeOSItem);

  const getW = useServerFn(getWorkshop);
  const updateElevadoresQty = useServerFn(updateWorkshopElevadores);

  // Queries
  const { data: ordens = [], isLoading: loadingOs } = useQuery({ queryKey: ["ordens"], queryFn: () => listOs() });
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: () => listCli() });
  const { data: veiculos = [] } = useQuery({ queryKey: ["veiculos"], queryFn: () => listVei() });
  const { data: estoque = [] } = useQuery({ queryKey: ["estoque"], queryFn: () => listEst() });
  const { data: workshop, refetch: refetchWorkshop } = useQuery({ queryKey: ["workshop"], queryFn: () => getW() });

  const qtyElevadores = workshop?.quantidade_elevadores ?? 7;

  // Map OSs by elevator bay (1-7+)
  const bayMap = useMemo(() => {
    const map: Record<number, any> = {};
    (ordens as any[]).forEach(o => {
      if (o.elevador && o.status !== "cancelada" && o.status !== "entregue") {
        map[o.elevador] = o;
      }
    });
    return map;
  }, [ordens]);

  const BAYS = useMemo(() => {
    const list = [];
    for (let i = 1; i <= qtyElevadores; i++) {
      list.push(i);
    }
    return list;
  }, [qtyElevadores]);

  // Mutations
  const mUpdateQty = useMutation({
    mutationFn: (qty: number) => updateElevadoresQty({ data: { id: workshop.id, quantidade: qty } }),
    onSuccess: () => {
      toast.success("Quantidade de elevadores atualizada!");
      refetchWorkshop();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const handleAddElevador = () => {
    if (!workshop?.id) return;
    mUpdateQty.mutate(qtyElevadores + 1);
  };

  const handleRemoveElevador = () => {
    if (!workshop?.id) return;
    if (qtyElevadores <= 1) {
      toast.error("É necessário ter pelo menos 1 elevador.");
      return;
    }
    const lastBay = qtyElevadores;
    if (bayMap[lastBay]) {
      toast.error(`O Elevador ${lastBay} está ocupado. Finalize ou desvincule a OS antes de removê-lo.`);
      return;
    }
    mUpdateQty.mutate(qtyElevadores - 1);
  };

  const mCreate = useMutation({
    mutationFn: (d: OSDialogData & { elevador: number; itens: any[] }) => createOs({ data: {
      cliente_id: d.cliente_id,
      veiculo_id: d.veiculo_id,
      descricao: d.descricao || "Atendimento Elevador " + d.elevador,
      elevador: d.elevador,
      itens: d.itens
    } as any }),
    onSuccess: () => {
      toast.success("Atendimento iniciado no elevador!");
      qc.invalidateQueries({ queryKey: ["ordens"] });
      setOsDialogOpen(false);
      setSelectedBay(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mReleaseWithoutBill = useMutation({
    mutationFn: (osId: string) => updateElevador({ data: { id: osId, elevador: null } }),
    onSuccess: () => {
      toast.success("Veículo liberado do elevador (OS continua ativa para faturamento)");
      qc.invalidateQueries({ queryKey: ["ordens"] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const mReleaseToPDV = useMutation({
    mutationFn: async (osId: string) => {
      // Conclui a OS e remove do elevador em uma única chamada
      await updateElevador({ data: { id: osId, elevador: null, status: "concluida" } });
    },
    onSuccess: () => {
      toast.success("OS concluída e enviada ao PDV para faturamento!");
      qc.invalidateQueries({ queryKey: ["ordens"] });
      // Navegar para o PDV
      navigate({ to: "/app/pdv" });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  function startAtendimento(bay: number) {
    setSelectedBay(bay);
    setOsDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <Wrench className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Painel de Elevadores</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie os boxes de atendimento e adicione produtos em tempo real.</p>
          </div>
        </div>

        {workshop && (
          <div className="flex items-center gap-2 bg-secondary/35 p-1.5 rounded-2xl border border-border/50 self-start sm:self-auto shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground px-3">
              {qtyElevadores} {qtyElevadores === 1 ? "Box" : "Boxes"}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRemoveElevador}
              disabled={mUpdateQty.isPending || qtyElevadores <= 1}
              className="h-8 px-2.5 rounded-xl text-xs gap-1"
              title="Remover último box de elevador"
            >
              <Minus className="h-3.5 w-3.5" /> Remover
            </Button>
            <Button
              size="sm"
              onClick={handleAddElevador}
              disabled={mUpdateQty.isPending}
              className="h-8 px-2.5 rounded-xl text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
              title="Adicionar novo box de elevador"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
        )}
      </motion.div>

      {loadingOs ? (
        <div className="p-20 text-center text-muted-foreground text-sm flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span>Carregando painel de controle...</span>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {BAYS.map((bayNum) => {
            const activeOS = bayMap[bayNum];
            return (
              <BayCard
                key={bayNum}
                bayNum={bayNum}
                os={activeOS}
                onStart={() => startAtendimento(bayNum)}
                onReleaseWithoutBill={(id) => mReleaseWithoutBill.mutate(id)}
                onReleaseToPDV={(id) => mReleaseToPDV.mutate(id)}
                estoque={estoque as any[]}
                onReload={() => qc.invalidateQueries({ queryKey: ["ordens"] })}
                addItemFn={addItem}
                removeItemFn={removeItem}
              />
            );
          })}
        </div>
      )}

      <StartOSDialog
        open={osDialogOpen}
        onOpenChange={(v) => { setOsDialogOpen(v); if(!v) setSelectedBay(null); }}
        bay={selectedBay}
        clientes={clientes as any[]}
        veiculos={veiculos as any[]}
        estoque={estoque as any[]}
        onSubmit={(d) => mCreate.mutate({ ...d, elevador: selectedBay! } as any)}
        loading={mCreate.isPending}
      />
    </div>
  );
}

function BayCard({
  bayNum,
  os,
  onStart,
  onReleaseWithoutBill,
  onReleaseToPDV,
  estoque,
  onReload,
  addItemFn,
  removeItemFn,
}: {
  bayNum: number;
  os: any;
  onStart: () => void;
  onReleaseWithoutBill: (osId: string) => void;
  onReleaseToPDV: (osId: string) => void;
  estoque: any[];
  onReload: () => void;
  addItemFn: any;
  removeItemFn: any;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [itemQtd, setItemQtd] = useState("1");
  const [customPrice, setCustomPrice] = useState("0");
  const [loadingAction, setLoadingAction] = useState(false);

  const [elapsedTime, setElapsedTime] = useState("");
  const [timerStyle, setTimerStyle] = useState({
    text: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20"
  });

  useEffect(() => {
    if (!os?.data_abertura) return;

    const calculateElapsed = () => {
      const start = new Date(os.data_abertura).getTime();
      const now = Date.now();
      const diff = now - start;

      if (diff <= 0) {
        setElapsedTime("00:00:00");
        setTimerStyle({
          text: "text-emerald-400",
          bg: "bg-emerald-500/10 border-emerald-500/20"
        });
        return;
      }

      const seconds = Math.floor((diff / 1000) % 60);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const hours = Math.floor(diff / (1000 * 60 * 60));

      const pad = (num: number) => String(num).padStart(2, "0");
      setElapsedTime(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);

      // Under 2h = Green, Under 6h = Amber, 6h+ = Rose
      if (diff < 7200000) {
        setTimerStyle({
          text: "text-emerald-400",
          bg: "bg-emerald-500/10 border-emerald-500/20"
        });
      } else if (diff < 21600000) {
        setTimerStyle({
          text: "text-amber-400",
          bg: "bg-amber-500/10 border-amber-500/20"
        });
      } else {
        setTimerStyle({
          text: "text-rose-400",
          bg: "bg-rose-500/10 border-rose-500/20"
        });
      }
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [os?.data_abertura]);

  const getOrdemFn = useServerFn(getOrdem);

  // Fetch items for this OS
  const { data: osDetails, refetch: refetchDetails } = useQuery({
    queryKey: ["os-details", os?.id],
    queryFn: async () => {
      if (!os?.id) return null;
      const getOs = await getOrdemFn({ data: { id: os.id } });
      return getOs;
    },
    enabled: !!os?.id
  });

  const catalogOptions = useMemo(() => {
    const q = searchVal.toLowerCase().trim();
    if (!q) return [];
    return estoque.filter(p => p.nome.toLowerCase().includes(q) || (p.codigo ?? "").toLowerCase().includes(q)).slice(0, 5);
  }, [estoque, searchVal]);

  const currentSubtotal = useMemo(() => {
    const qty = Number(itemQtd.replace(",", ".")) || 0;
    const price = selectedProduct ? Number(selectedProduct.preco_venda) : (Number(customPrice.replace(",", ".")) || 0);
    return qty * price;
  }, [itemQtd, selectedProduct, customPrice]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!os?.id) return;
    
    let desc = searchVal.trim();
    let price = 0;
    let estoqueId = null;
    let tipo: "servico" | "peca" = "servico";

    if (selectedProduct) {
      desc = selectedProduct.nome;
      price = Number(selectedProduct.preco_venda);
      estoqueId = selectedProduct.id;
      tipo = "peca";
    } else {
      price = Number(customPrice.replace(",", ".")) || 0;
    }

    if (!desc) {
      toast.error("Informe a descrição ou selecione um produto");
      return;
    }

    setLoadingAction(true);
    try {
      await addItemFn({
        os_id: os.id,
        tipo,
        descricao: desc,
        quantidade: Number(itemQtd.replace(",", ".")) || 1,
        valor_unit: price,
        estoque_item_id: estoqueId
      });
      toast.success("Item adicionado");
      refetchDetails();
      onReload();
      
      // Reset form
      setSearchVal("");
      setSelectedProduct(null);
      setItemQtd("1");
      setCustomPrice("0");
      setShowAddForm(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar item");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!os?.id) return;
    if (!confirm("Remover este item?")) return;
    setLoadingAction(true);
    try {
      await removeItemFn({ id: itemId, os_id: os.id });
      toast.success("Item removido");
      refetchDetails();
      onReload();
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover item");
    } finally {
      setLoadingAction(false);
    }
  };

  const formattedTotal = useMemo(() => {
    const total = osDetails?.valor_total || os?.valor_total || 0;
    return Number(total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }, [osDetails, os]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass rounded-2xl p-5 border flex flex-col justify-between transition-all",
        os ? "border-primary/20 shadow-[0_0_20px_-10px_oklch(0.65_0.18_240/0.3)] bg-primary/5" : "border-border/60"
      )}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className={cn(
            "text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border",
            os ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary text-muted-foreground border-border/40"
          )}>
            Elevador {bayNum}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {os ? `OS #${os.numero}` : "Livre"}
          </span>
        </div>

        {!os ? (
          <div className="py-8 text-center flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-3">
              <Play className="h-5 w-5 text-muted-foreground/60" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">Box disponível para atendimento</p>
            <Button size="sm" onClick={onStart} className="gap-2">
              <Plus className="h-4 w-4" /> Iniciar OS
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" /> {os.clientes?.nome}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Car className="h-3.5 w-3.5" /> {[os.veiculos?.marca, os.veiculos?.modelo].filter(Boolean).join(" ")} · {os.veiculos?.placa}
              </div>
            </div>

            {/* Contador de Tempo em Atendimento */}
            {elapsedTime && (
              <div className={cn("flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all duration-300 shadow-sm", timerStyle.bg)}>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 animate-pulse" /> Tempo de Atendimento
                </div>
                <span className={cn("font-mono font-bold tabular-nums tracking-wide", timerStyle.text)}>
                  {elapsedTime}
                </span>
              </div>
            )}


            <div className="border-t border-border/40 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peças & Serviços</span>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={handleAdd} className="bg-secondary/40 p-3 rounded-xl border border-border/60 mb-3 space-y-2 relative">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Buscar Produto ou Digitar Serviço</Label>
                    <Input
                      value={searchVal}
                      onChange={e => { setSearchVal(e.target.value); setSelectedProduct(null); }}
                      placeholder="Ex: Óleo 5W30 ou Alinhamento"
                      className="h-8 text-xs bg-background"
                      autoFocus
                    />
                    {catalogOptions.length > 0 && (
                      <div className="absolute left-3 right-3 bg-popover border border-border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto text-xs mt-1 divide-y divide-border">
                        {catalogOptions.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedProduct(p);
                              setSearchVal(p.nome);
                              setCustomPrice(String(p.preco_venda));
                            }}
                            className="w-full text-left p-2.5 hover:bg-secondary/80 transition flex justify-between"
                          >
                            <span>{p.nome}</span>
                            <span className="font-semibold text-primary">{Number(p.preco_venda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {selectedProduct && (
                    <div className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                      <Check className="h-3 w-3" /> Produto do estoque selecionado ({Number(selectedProduct.preco_venda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
                    </div>
                  )}

                  {currentSubtotal > 0 && (
                    <div className="text-[10px] text-primary/80 font-medium flex justify-between items-center bg-primary/10 border border-primary/25 rounded-md px-2 py-1">
                      <span>Subtotal do Item:</span>
                      <span className="font-bold tabular-nums text-primary">{currentSubtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </div>
                  )}

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                      <Input
                        type="text"
                        value={itemQtd}
                        onChange={e => setItemQtd(e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                    <div className="flex-[2]">
                      <Label className="text-[10px] text-muted-foreground">Preço Unit. (R$)</Label>
                      <Input
                        type="text"
                        value={selectedProduct ? String(selectedProduct.preco_venda) : customPrice}
                        disabled={!!selectedProduct}
                        onChange={e => setCustomPrice(e.target.value)}
                        placeholder="0,00"
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                    <Button type="submit" size="sm" className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90" disabled={loadingAction}>
                      Add
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 styled-scrollbar">
                {osDetails?.itens?.map((it: any) => (
                  <div key={it.id} className="flex items-center justify-between text-xs bg-secondary/20 p-2 rounded-lg hover:bg-secondary/40 transition">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{it.descricao}</div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {Number(it.valor_unit).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} × {Number(it.quantidade)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold tabular-nums">
                        {(Number(it.quantidade) * Number(it.valor_unit)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(it.id)}
                        disabled={loadingAction}
                        className="text-destructive hover:bg-destructive/15 p-1 rounded transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {(!osDetails?.itens || osDetails.itens.length === 0) && (
                  <div className="text-center py-4 text-xs text-muted-foreground">Nenhum item adicionado ao carro ainda.</div>
                )}
              </div>
            </div>

            <div className="border-t border-border/40 pt-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Acumulado</span>
              <span className="font-display text-lg font-bold tabular-nums text-primary">{formattedTotal}</span>
            </div>
          </div>
        )}
      </div>

      {os && (
        <div className="grid grid-cols-2 gap-2 mt-5 border-t border-border/40 pt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReleaseWithoutBill(os.id)}
            className="text-xs gap-1.5 h-9"
            title="Libera o elevador mas mantém a OS aberta para faturar depois"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" /> Tirar Box
          </Button>
          <Button
            size="sm"
            onClick={() => onReleaseToPDV(os.id)}
            className="text-xs gap-1.5 h-9 bg-emerald-500 hover:bg-emerald-600 text-white"
            title="Conclui a OS e abre o PDV para cobrança"
          >
            <DollarSign className="h-3.5 w-3.5" /> Enviar ao PDV
          </Button>
        </div>
      )}
    </motion.div>
  );
}

function StartOSDialog({ open, onOpenChange, bay, clientes, veiculos, estoque, onSubmit, loading }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bay: number | null;
  clientes: { id: string; nome: string }[];
  veiculos: { id: string; cliente_id: string; placa: string; marca: string | null; modelo: string | null }[];
  estoque: any[];
  onSubmit: (d: OSDialogData & { itens: any[] }) => void;
  loading: boolean;
}) {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<OSDialogData>({
    resolver: zodResolver(OSDialogSchema),
    defaultValues: { cliente_id: "", veiculo_id: "", descricao: "" },
  });

  const [dialogItens, setDialogItens] = useState<{
    id: string;
    tipo: "servico" | "peca";
    descricao: string;
    quantidade: number;
    valor_unit: number;
    estoque_item_id?: string | null;
  }[]>([]);

  // Item form states
  const [searchVal, setSearchVal] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [itemQtd, setItemQtd] = useState("1");
  const [customPrice, setCustomPrice] = useState("0");

  const cliId = watch("cliente_id");
  const filteredVehicles = useMemo(() => {
    return veiculos.filter(v => !cliId || v.cliente_id === cliId);
  }, [veiculos, cliId]);

  const catalogOptions = useMemo(() => {
    const q = searchVal.toLowerCase().trim();
    if (!q) return [];
    return estoque.filter(p => p.nome.toLowerCase().includes(q) || (p.codigo ?? "").toLowerCase().includes(q)).slice(0, 5);
  }, [estoque, searchVal]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    let desc = searchVal.trim();
    let price = 0;
    let estoqueId = null;
    let tipo: "servico" | "peca" = "servico";

    if (selectedProduct) {
      desc = selectedProduct.nome;
      price = Number(selectedProduct.preco_venda);
      estoqueId = selectedProduct.id;
      tipo = "peca";
    } else {
      price = Number(customPrice.replace(",", ".")) || 0;
    }

    if (!desc) {
      toast.error("Informe a descrição ou selecione um produto");
      return;
    }

    setDialogItens(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        tipo,
        descricao: desc,
        quantidade: Number(itemQtd.replace(",", ".")) || 1,
        valor_unit: price,
        estoque_item_id: estoqueId
      }
    ]);

    // Reset item form
    setSearchVal("");
    setSelectedProduct(null);
    setItemQtd("1");
    setCustomPrice("0");
  };

  const handleRemoveItem = (id: string) => {
    setDialogItens(prev => prev.filter(it => it.id !== id));
  };

  const currentSubtotal = useMemo(() => {
    const qty = Number(itemQtd.replace(",", ".")) || 0;
    const price = selectedProduct ? Number(selectedProduct.preco_venda) : (Number(customPrice.replace(",", ".")) || 0);
    return qty * price;
  }, [itemQtd, selectedProduct, customPrice]);

  const totalVal = useMemo(() => {
    return dialogItens.reduce((sum, item) => sum + item.quantidade * item.valor_unit, 0);
  }, [dialogItens]);

  const handleClose = (v: boolean) => {
    if (!v) {
      reset();
      setDialogItens([]);
      setSearchVal("");
      setSelectedProduct(null);
      setItemQtd("1");
      setCustomPrice("0");
    }
    onOpenChange(v);
  };

  const handleFormSubmit = (data: OSDialogData) => {
    onSubmit({
      ...data,
      itens: dialogItens.map(it => ({
        tipo: it.tipo,
        descricao: it.descricao,
        quantidade: it.quantidade,
        valor_unit: it.valor_unit,
        estoque_item_id: it.estoque_item_id
      }))
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Iniciar Atendimento — Elevador {bay}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 md:grid-cols-2 pt-2">
          {/* Coluna 1: Dados da OS */}
          <form id="start-os-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="os_cliente_id">Cliente *</Label>
              <select id="os_cliente_id" {...register("cliente_id")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1">
                <option value="">Selecione…</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              {errors.cliente_id && <p className="text-xs text-destructive mt-1">{errors.cliente_id.message}</p>}
            </div>

            <div>
              <Label htmlFor="os_veiculo_id">Veículo *</Label>
              <select id="os_veiculo_id" {...register("veiculo_id")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1">
                <option value="">Selecione…</option>
                {filteredVehicles.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.marca ?? ""} {v.modelo ?? ""}</option>)}
              </select>
              {errors.veiculo_id && <p className="text-xs text-destructive mt-1">{errors.veiculo_id.message}</p>}
            </div>

            <div>
              <Label htmlFor="os_desc">Observação Inicial</Label>
              <Input id="os_desc" {...register("descricao")} placeholder="Ex: Troca de óleo e filtros padrão" className="mt-1" />
            </div>
            
            <div className="pt-4 border-t border-border/40">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Valor Final (Total)</div>
                <div className="text-2xl font-bold font-display text-primary mt-1">
                  {totalVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              </div>
            </div>
          </form>

          {/* Coluna 2: Adicionar Produtos / Serviços */}
          <div className="space-y-4 border-l border-border/40 pl-0 md:pl-6">
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Incluir Peças & Serviços</div>
            
            <div className="bg-secondary/40 p-3 rounded-xl border border-border/60 space-y-2.5 relative">
              <div>
                <Label className="text-[10px] text-muted-foreground">Buscar Produto ou Digitar Serviço</Label>
                <Input
                  value={searchVal}
                  onChange={e => { setSearchVal(e.target.value); setSelectedProduct(null); }}
                  placeholder="Ex: Óleo 5W30 ou Alinhamento"
                  className="h-8 text-xs bg-background mt-0.5"
                />
                {catalogOptions.length > 0 && (
                  <div className="absolute left-3 right-3 bg-popover border border-border rounded-lg shadow-lg z-20 max-h-36 overflow-y-auto text-xs mt-1 divide-y divide-border">
                    {catalogOptions.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProduct(p);
                          setSearchVal(p.nome);
                          setCustomPrice(String(p.preco_venda));
                        }}
                        className="w-full text-left p-2.5 hover:bg-secondary/80 transition flex justify-between"
                      >
                        <span>{p.nome}</span>
                        <span className="font-semibold text-primary">{Number(p.preco_venda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                  <Check className="h-3 w-3" /> Produto do estoque selecionado ({Number(selectedProduct.preco_venda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
                </div>
              )}

              {currentSubtotal > 0 && (
                <div className="text-[10px] text-primary/80 font-medium flex justify-between items-center bg-primary/10 border border-primary/25 rounded-md px-2 py-1">
                  <span>Subtotal do Item:</span>
                  <span className="font-bold tabular-nums text-primary">{currentSubtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                  <Input
                    type="text"
                    value={itemQtd}
                    onChange={e => setItemQtd(e.target.value)}
                    className="h-8 text-xs bg-background mt-0.5"
                  />
                </div>
                
                <div className="flex-[2]">
                  <Label className="text-[10px] text-muted-foreground">Preço Unit. (R$)</Label>
                  <Input
                    type="text"
                    value={selectedProduct ? String(selectedProduct.preco_venda) : customPrice}
                    disabled={!!selectedProduct}
                    onChange={e => setCustomPrice(e.target.value)}
                    placeholder="0,00"
                    className="h-8 text-xs bg-background mt-0.5"
                  />
                </div>
                
                <Button type="button" onClick={handleAddItem} size="sm" className="h-8 px-3.5 bg-primary text-primary-foreground hover:bg-primary/90">
                  Incluir
                </Button>
              </div>
            </div>

            {/* Listagem de itens temporários */}
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 styled-scrollbar">
              {dialogItens.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-xs bg-secondary/20 p-2 rounded-lg hover:bg-secondary/40 transition">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{it.descricao}</div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      {it.valor_unit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} × {it.quantidade}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">
                      {(it.quantidade * it.valor_unit).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      className="text-destructive hover:bg-destructive/15 p-1 rounded transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {dialogItens.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground">Nenhum produto ou serviço incluído nesta OS ainda.</div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t border-border/40">
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button type="submit" form="start-os-form" disabled={loading}>
            {loading ? "Iniciando..." : "Confirmar e Iniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
