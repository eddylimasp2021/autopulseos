# Plano de Implementação

Stack: Lovable Cloud (Postgres + RLS nativo). Isolamento por `workshop_id`. WhatsApp via UAZAPI.

## Fase 1 — Schema multi-tenant + RLS

Criar tabelas no schema `public`, todas com `workshop_id uuid not null` e RLS escopada via `is_workshop_member(auth.uid(), workshop_id)`. GRANTs para `authenticated` e `service_role`.

Tabelas:
- `clientes` — nome, telefone, email, documento, endereço, observações
- `veiculos` — cliente_id, placa, marca, modelo, ano, km_atual, cor
- `ordens_servico` — numero (seq por oficina), cliente_id, veiculo_id, status (`aberta|em_andamento|aguardando_peca|concluida|cancelada|entregue`), descricao, valor_total, mecanico_id, data_abertura, data_conclusao
- `os_itens` — os_id, descricao, tipo (`servico|peca`), quantidade, valor_unit, estoque_item_id (nullable)
- `troca_oleo` — veiculo_id, cliente_id, data, km_atual, km_proxima, oleo_tipo, filtro, proxima_data, os_id (nullable), status (`pendente|notificado|realizado`)
- `estoque_itens` — codigo, nome, categoria, quantidade, qtd_minima, preco_custo, preco_venda, unidade
- `estoque_movimentacoes` — item_id, tipo (`entrada|saida|ajuste`), quantidade, motivo, os_id (nullable), user_id
- `financeiro_lancamentos` — tipo (`receita|despesa`), categoria, descricao, valor, data_vencimento, data_pagamento, status (`pendente|pago|atrasado`), os_id (nullable), cliente_id (nullable), forma_pagamento
- `whatsapp_mensagens` — destino, telefone, payload, status (`pendente|enviado|falhou`), evento, ref_tipo, ref_id, tentativas, erro
- `whatsapp_config` — token, instancia, ativo, template_os_concluida, template_lembrete_oleo, template_cobranca

Triggers/funções:
- `set_updated_at` em todas
- `set_workshop_id_from_membership` — preenche workshop_id no insert quando user só tem 1 oficina
- `os_numero_sequencia` — sequencial por oficina
- `os_status_change_notify` → enfileira mensagem WhatsApp quando status muda para `concluida` ou `entregue`
- `troca_oleo_proxima_data_calc` — calcula `proxima_data` (+6 meses) e `km_proxima` (+5000)
- `estoque_baixa_on_os_concluida` — debita estoque ao concluir OS
- `financeiro_from_os` — cria lançamento receita ao concluir OS

## Fase 2 — Conectar módulos ao backend

Para cada página (`app.clientes`, `app.veiculos`, `app.ordens`, `app.troca-oleo`, `app.estoque`, `app.financeiro`):
1. Criar `src/lib/<modulo>.functions.ts` com `createServerFn` protegidos por `requireSupabaseAuth` (list, get, create, update, delete).
2. Substituir mocks/placeholders por React Query + `useServerFn` (padrão `queryOptions` + `useSuspenseQuery`).
3. Forms com `react-hook-form` + zod, toasts via sonner.
4. Filtros básicos por status/busca; paginação simples.
5. Dashboard (`/app`) com contadores reais (OS abertas, estoque baixo, recebíveis, lembretes oleo).

## Fase 3 — Automação WhatsApp (UAZAPI)

- Server fn `enqueueWhatsappMessage` (chamada pelos triggers via webhook ou diretamente pelos handlers de update).
- Server route `/api/public/cron/whatsapp-dispatch` — processa fila `whatsapp_mensagens` pendentes, chama UAZAPI, atualiza status. Autenticada via `apikey` header.
- pg_cron a cada 1 min chamando o endpoint.
- Página `app.whatsapp` — config (token/instância), templates, histórico de envios, status conexão.
- Gatilhos cobertos:
  - OS muda para `concluida` → mensagem ao cliente
  - OS muda para `entregue` → agradecimento
  - `troca_oleo` com `proxima_data` em ≤7 dias e status `pendente` → lembrete (job diário)
  - Lançamento financeiro vencendo em 3 dias → cobrança (opcional, toggle config)

## Detalhes técnicos

- Secret necessário: `UAZAPI_TOKEN` e `UAZAPI_INSTANCE_URL` — pedirei via add_secret na Fase 3.
- Todas as funções usam `context.supabase` (RLS aplicada). Dispatcher do cron usa `supabaseAdmin` para varrer fila.
- Tipos gerados automaticamente em `src/integrations/supabase/types.ts` após migration.

## Entrega faseada

Vou entregar a **Fase 1 (migration completa)** primeiro nesta resposta. Após sua aprovação da migration, sigo com Fase 2 (módulo a módulo) e depois Fase 3.
