import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Users, Search, Plus, Phone, Mail, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  listClientes, createCliente, updateCliente, deleteCliente,
} from "@/lib/clientes.functions";

export const Route = createFileRoute("/_authenticated/app/clientes")({ component: Page });

const Schema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(120),
  telefone: z.string().trim().max(30).optional(),
  email: z.string().trim().email("Email inválido").max(160).optional().or(z.literal("")),
  documento: z.string().trim().max(30).optional(),
  endereco: z.string().trim().max(255).optional(),
  cidade: z.string().trim().max(80).optional(),
  estado: z.string().trim().max(40).optional(),
  cep: z.string().trim().max(15).optional(),
  observacoes: z.string().trim().max(1000).optional(),
});
type FormData = z.infer<typeof Schema>;
type Cliente = { id: string; nome: string; telefone: string | null; email: string | null; documento: string | null; cidade: string | null; estado: string | null };

function Page() {
  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const list = useServerFn(listClientes);
  const create = useServerFn(createCliente);
  const update = useServerFn(updateCliente);
  const remove = useServerFn(deleteCliente);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => list(),
  });

  const mCreate = useMutation({
    mutationFn: (d: FormData) => create({ data: d as any }),
    onSuccess: () => { toast.success("Cliente criado"); qc.invalidateQueries({ queryKey: ["clientes"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mUpdate = useMutation({
    mutationFn: (d: FormData & { id: string }) => update({ data: d as any }),
    onSuccess: () => { toast.success("Cliente atualizado"); qc.invalidateQueries({ queryKey: ["clientes"] }); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Cliente excluído"); qc.invalidateQueries({ queryKey: ["clientes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (clientes as Cliente[]).filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (c.telefone ?? "").includes(busca),
  );

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(c: Cliente) { setEditing(c); setOpen(true); }
  function handleDelete(c: Cliente) {
    if (confirm(`Excluir "${c.nome}"? Esta ação não pode ser desfeita.`)) mDelete.mutate(c.id);
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-neon)] neon-border">
            <Users className="h-5 w-5 text-neon-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">Cadastro e CRM de clientes da oficina.</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 shadow-[0_0_20px_-4px_oklch(0.65_0.18_240/0.4)]">
          <Plus className="h-4 w-4" /> Novo cliente
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone..." className="w-full rounded-xl border border-border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground" />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Contato</th>
                <th className="px-5 py-3 font-medium">Documento</th>
                <th className="px-5 py-3 font-medium">Cidade</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-border/40 hover:bg-secondary/40 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                        {c.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </div>
                      <span className="font-medium">{c.nome}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="space-y-0.5">
                      {c.telefone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" /> {c.telefone}</div>}
                      {c.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3" /> {c.email}</div>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">{c.documento ?? "—"}</td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">{c.cidade ? `${c.cidade}${c.estado ? "/" + c.estado : ""}` : "—"}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(c)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary transition" title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(c)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-destructive/20 text-destructive transition" title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="p-10 text-center text-muted-foreground text-sm">Carregando…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-10 text-center text-muted-foreground text-sm">Nenhum cliente cadastrado.</div>
        )}
      </motion.div>

      <ClienteDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        editing={editing}
        onSubmit={(d) => editing ? mUpdate.mutate({ ...d, id: editing.id }) : mCreate.mutate(d)}
        loading={mCreate.isPending || mUpdate.isPending}
      />
    </div>
  );
}

function ClienteDialog({ open, onOpenChange, editing, onSubmit, loading }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Cliente | null;
  onSubmit: (d: FormData) => void;
  loading: boolean;
}) {
  const form = useForm<FormData>({
    resolver: zodResolver(Schema),
    values: {
      nome: editing?.nome ?? "",
      telefone: editing?.telefone ?? "",
      email: editing?.email ?? "",
      documento: editing?.documento ?? "",
      endereco: "",
      cidade: editing?.cidade ?? "",
      estado: editing?.estado ?? "",
      cep: "",
      observacoes: "",
    },
  });
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => onSubmit(d))} className="space-y-3">
          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" {...register("nome")} />
            {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" {...register("telefone")} />
            </div>
            <div>
              <Label htmlFor="documento">CPF/CNPJ</Label>
              <Input id="documento" {...register("documento")} />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" {...register("endereco")} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" {...register("cidade")} />
            </div>
            <div>
              <Label htmlFor="estado">UF</Label>
              <Input id="estado" {...register("estado")} maxLength={2} />
            </div>
          </div>
          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" {...register("observacoes")} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
