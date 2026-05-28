import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ from: z.string().min(1), to: z.string().min(1) });

export const listAgenda = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof Input>) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const [os, troca] = await Promise.all([
      supabase
        .from("ordens_servico")
        .select("id,numero,status,descricao,data_abertura,valor_total,clientes(nome),veiculos(placa,marca,modelo)")
        .gte("data_abertura", data.from + "T00:00:00")
        .lte("data_abertura", data.to + "T23:59:59")
        .order("data_abertura", { ascending: true }),
      supabase
        .from("troca_oleo")
        .select("id,data,status,oleo_tipo,oleo_marca,clientes(nome),veiculos(placa,marca,modelo)")
        .gte("data", data.from)
        .lte("data", data.to)
        .order("data", { ascending: true }),
    ]);
    if (os.error) throw new Error(os.error.message);
    if (troca.error) throw new Error(troca.error.message);

    const eventos = [
      ...(os.data ?? []).map((o: any) => ({
        id: `os-${o.id}`,
        tipo: "os" as const,
        data: o.data_abertura,
        titulo: `OS #${o.numero}${o.descricao ? " · " + o.descricao : ""}`,
        status: o.status,
        cliente: o.clientes?.nome ?? "—",
        veiculo: o.veiculos ? `${o.veiculos.marca ?? ""} ${o.veiculos.modelo ?? ""} · ${o.veiculos.placa}`.trim() : "—",
        valor: Number(o.valor_total || 0),
      })),
      ...(troca.data ?? []).map((t: any) => ({
        id: `troca-${t.id}`,
        tipo: "troca" as const,
        data: t.data + "T08:00:00",
        titulo: `Troca de óleo${t.oleo_tipo ? " · " + t.oleo_tipo : ""}${t.oleo_marca ? " " + t.oleo_marca : ""}`,
        status: t.status,
        cliente: t.clientes?.nome ?? "—",
        veiculo: t.veiculos ? `${t.veiculos.marca ?? ""} ${t.veiculos.modelo ?? ""} · ${t.veiculos.placa}`.trim() : "—",
        valor: 0,
      })),
    ];
    eventos.sort((a, b) => a.data.localeCompare(b.data));
    return eventos;
  });