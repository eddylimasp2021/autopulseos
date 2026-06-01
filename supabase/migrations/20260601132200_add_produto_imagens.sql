ALTER TABLE public.estoque_itens ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- Cria o bucket se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('produtos', 'produtos', true) 
ON CONFLICT (id) DO NOTHING;

-- Cria políticas de segurança (RSL) para o bucket 'produtos'
CREATE POLICY "Imagens de produtos sao publicas" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'produtos');

CREATE POLICY "Usuarios autenticados podem inserir imagens" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'produtos');

CREATE POLICY "Usuarios autenticados podem editar imagens" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'produtos');

CREATE POLICY "Usuarios autenticados podem remover imagens" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'produtos');
