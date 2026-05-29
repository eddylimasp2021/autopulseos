-- Restaura a permissão de execução da função para usuários autenticados
-- A migração anterior revogou isso e quebrou o RLS de todas as tabelas!
GRANT EXECUTE ON FUNCTION public.is_workshop_member(uuid, uuid) TO authenticated;
